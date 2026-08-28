import { commitCallResult, db, initDatabase, resolveScorecard } from "@/lib/db";
import { runAudioProcessor } from "@/lib/processing/audio-processor";
import { useGeminiListenMode } from "@/lib/ai/llm-provider";
import {
  listenResultFromTranscript,
  runListenPass,
} from "@/lib/ai/listen-pass";
import { runScorePass } from "@/lib/ai/score-pass";
import { verifyAudit } from "@/lib/ai/call-quality";
import { v4 as uuidv4 } from "uuid";
import type { UploadStatus } from "@/lib/db/schema";
import type { NormalizedAudit, TranscriptSegment } from "@/lib/ai/prompts";
import type { ListenPassResult } from "@/lib/ai/listen-pass";
import {
  cleanPersonName,
  extractNamesFromTranscript,
  polishTranscript,
  preferPersonName,
  resolveCallNames,
} from "@/lib/ai/call-quality";
import { unlink } from "fs/promises";

initDatabase();

async function updateStatus(
  callId: string,
  status: UploadStatus,
  error?: string
) {
  db.callRecords.update(callId, {
    uploadStatus: status,
    processingError: error || null,
    updatedAt: new Date().toISOString(),
  });
}

function buildAuditBundle(
  callId: string,
  audit: NormalizedAudit,
  agentDisposition: string | null,
  segments: TranscriptSegment[],
  duration: number,
  listen: ListenPassResult,
  agentHint?: string | null
) {
  const polished = polishTranscript(segments);
  const names = resolveCallNames({
    modelAgent: preferPersonName(listen.agent_name, audit.agentName),
    modelClient: preferPersonName(listen.client_name, audit.clientName),
    transcript: polished,
    agentHint,
  });
  const agentName = names.agent;
  const clientName = names.client;

  const agentConfidence = agentName === "Unknown" ? 0.35 : 0.9;
  const clientConfidence = clientName === "Unknown" ? 0.35 : 0.85;

  const now = new Date().toISOString();

  return {
    callUpdates: {
      audioDuration: duration,
      uploadStatus: "completed" as const,
      processingError: null,
      updatedAt: now,
    },
    participants: [
      {
        id: uuidv4(),
        callId,
        role: "agent",
        name: agentName,
        confidence: agentConfidence,
      },
      {
        id: uuidv4(),
        callId,
        role: "client",
        name: clientName,
        confidence: clientConfidence,
      },
    ],
    segments: polished.map((segment) => ({
      id: uuidv4(),
      callId,
      speakerLabel: segment.speaker,
      startTime: segment.start,
      endTime: segment.end,
      text: segment.text,
    })),
    disposition: {
      id: uuidv4(),
      callId,
      agentSelectedDisposition:
        audit.agentSelectedDisposition || agentDisposition || null,
      aiRecommendedDisposition: audit.recommendedDisposition || null,
      dispositionMatch: audit.dispositionMatch,
      rationale: audit.dispositionRationale,
    },
    report: {
      id: uuidv4(),
      callId,
      summary: audit.summary,
      whatWentWrong: JSON.stringify(audit.whatWentWrong),
      whatWentWell: JSON.stringify(audit.whatWentWell),
      whatShouldHaveBeenDone: JSON.stringify(audit.whatShouldHaveBeenDone),
      focusAreas: JSON.stringify(audit.focusAreas),
      teamLeaderFeedback: audit.teamLeaderFeedback,
      immediateCoachingNotes: audit.immediateCoachingNotes,
      priorityImprovementFocus: audit.priorityImprovementFocus,
      overallScore: audit.overallScore,
      grade: audit.grade,
      passFail: audit.passFail,
      rubricJson: JSON.stringify(audit.rubric),
      rawLlmJson: JSON.stringify({
        listen,
        score: audit.raw,
        warnings: audit.integrityWarnings,
      }),
      managerSummary: audit.managerSummary || null,
      integrityWarnings: JSON.stringify(audit.integrityWarnings),
      complianceCheck: JSON.stringify(audit.complianceCheck),
      createdAt: now,
    },
  };
}

/**
 * Gemini hears the call (listen pass), then a text model scores the notes.
 */
async function processWithGeminiListen(callId: string): Promise<void> {
  const call = db.callRecords.findById(callId);
  if (!call) throw new Error(`Call ${callId} not found`);

  const scorecard = resolveScorecard(call.scorecardId);

  await updateStatus(callId, "listening");
  console.log(`[pipeline] Listen pass for ${callId} · scorecard=${scorecard.name}`);

  const listen = await runListenPass(call.originalPath, undefined, {
    agentName: call.agentNameHint || undefined,
  });

  await updateStatus(callId, "analyzing");
  console.log(`[pipeline] Score pass for ${callId}`);

  const scored = await runScorePass(
    listen,
    scorecard,
    call.agentDisposition
  );
  const { audit } = verifyAudit(scored, listen, scorecard);

  const segments = listen.transcript_segments;
  if (!segments.length) {
    throw new Error(
      "Listen pass returned no transcript segments — retry or check the audio file"
    );
  }

  const duration =
    listen.duration_seconds ||
    audit.durationSeconds ||
    Math.max(...segments.map((s) => s.end), 0);

  const bundle = buildAuditBundle(
    callId,
    audit,
    call.agentDisposition,
    segments,
    duration,
    listen,
    call.agentNameHint
  );
  commitCallResult({ callId, ...bundle });
  console.log(
    `[pipeline] Completed ${callId} · agent=${bundle.participants[0].name} client=${bundle.participants[1].name} disp=${bundle.disposition.aiRecommendedDisposition} score=${bundle.report.overallScore}`
  );
}

/**
 * Classic path: Whisper (+ diarization) then score pass from transcript notes.
 */
async function processWithTranscriptPipeline(callId: string): Promise<void> {
  const call = db.callRecords.findById(callId);
  if (!call) throw new Error(`Call ${callId} not found`);

  const scorecard = resolveScorecard(call.scorecardId);

  await updateStatus(callId, "transcribing");
  const processingResult = await runAudioProcessor(call.originalPath);

  await updateStatus(callId, "analyzing");

  const transcript = polishTranscript(
    processingResult.segments.map((s) => ({
      speaker: s.speaker,
      start: s.start,
      end: s.end,
      text: s.text,
    }))
  );

  const extracted = extractNamesFromTranscript(transcript);
  const agentHint =
    cleanPersonName(processingResult.participants.agent.name) !== "Unknown"
      ? cleanPersonName(processingResult.participants.agent.name)
      : extracted.agent;
  const clientHint =
    cleanPersonName(processingResult.participants.client.name) !== "Unknown"
      ? cleanPersonName(processingResult.participants.client.name)
      : extracted.client;

  const duration =
    processingResult.duration ||
    Math.max(...transcript.map((s) => s.end), 0);

  const listen = listenResultFromTranscript(transcript, duration, {
    agent: call.agentNameHint || agentHint,
    client: clientHint,
  });

  const scored = await runScorePass(
    listen,
    scorecard,
    call.agentDisposition
  );
  const { audit } = verifyAudit(scored, listen, scorecard);

  const bundle = buildAuditBundle(
    callId,
    audit,
    call.agentDisposition,
    audit.transcriptSegments?.length ? audit.transcriptSegments : transcript,
    duration,
    listen,
    call.agentNameHint
  );

  if (bundle.participants[0].name === "Unknown" && agentHint !== "Unknown") {
    bundle.participants[0].name = agentHint;
    bundle.participants[0].confidence = 0.75;
  }
  if (bundle.participants[1].name === "Unknown" && clientHint !== "Unknown") {
    bundle.participants[1].name = clientHint;
    bundle.participants[1].confidence = 0.75;
  }

  commitCallResult({ callId, ...bundle });
}

async function discardAudioIfConfigured(filePath: string): Promise<void> {
  const flag = (process.env.KEEP_AUDIO || "").toLowerCase();
  const keep =
    flag === "true" ||
    flag === "1" ||
    (flag === "" && process.env.NODE_ENV !== "production");
  if (keep) return;
  try {
    await unlink(filePath);
    console.log(`[pipeline] Discarded audio ${filePath}`);
  } catch {
    /* already gone */
  }
}

export async function processCall(callId: string): Promise<void> {
  const call = db.callRecords.findById(callId);
  if (!call) throw new Error(`Call ${callId} not found`);

  try {
    if (useGeminiListenMode()) {
      await processWithGeminiListen(callId);
    } else {
      await processWithTranscriptPipeline(callId);
    }
    const finished = db.callRecords.findById(callId);
    if (finished?.originalPath) {
      await discardAudioIfConfigured(finished.originalPath);
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown processing error";
    console.error(`Processing failed for call ${callId}:`, message);
    await updateStatus(callId, "failed", message);
  }
}

export function startProcessing(callId: string): void {
  processCall(callId).catch(console.error);
}
