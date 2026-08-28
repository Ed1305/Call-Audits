/**
 * Observe-only Gemini audio pass. No rubric, scoring, or coaching.
 * Scoring happens later from this JSON, like a TL working from notes.
 */

import fs from "fs/promises";
import path from "path";
import {
  buildAudioPart,
  callGemini,
  extractGeminiText,
} from "./gemini";
import { polishTranscript, resolveCallNames } from "./call-quality";
import type { TranscriptSegment } from "./prompts";

export interface AcousticEvent {
  type:
    | "dead_air"
    | "talk_over"
    | "tone_shift"
    | "inaudible"
    | "hold"
    | "background_noise";
  start: number;
  end: number;
  speaker: "Agent" | "Client" | "both" | "none";
  detail: string;
}

export interface ListenPassResult {
  source: "audio" | "transcript";
  duration_seconds: number;
  audio_quality: "clear" | "acceptable" | "poor";
  inaudible_spans: { start: number; end: number }[];
  transcript_segments: {
    speaker: "Agent" | "Client";
    start: number;
    end: number;
    text: string;
  }[];
  acoustic_events: AcousticEvent[];
  delivery: {
    agent_talk_ratio: number;
    agent_pace: "rushed" | "measured" | "slow";
    agent_tone: string[];
    client_tone: string[];
    longest_dead_air_seconds: number;
    talk_over_count: number;
  };
  agent_name: string;
  client_name: string;
  observed_outcome: string;
}

const LISTEN_PASS_SYSTEM_PROMPT = `You are a call-center QA note-taker sitting with headphones. Your only job is to observe this recording. You are not scoring, coaching, or judging the agent.

Listen end-to-end. Write down what was said, when, and what it sounded like. Do not form opinions about quality, compliance, or what the agent "should" have done.

Rules:
- Diarize as Agent / Client (never Speaker 1/2). The agent is whoever opens with a company/brand and drives the pitch. A pickup like "Yebo" / "Hello" before the pitch is the Client.
- Transcribe the WHOLE call, greeting to drop. Do not summarise the middle. Do not skip turns. Do not end any utterance with ellipsis (...). If the pitch is long, write the actual sentences — split into multiple Agent turns at sentence breaks if needed, still the real words.
- One speaker per segment. Short client replies (Yebo, Okay, Mm, Hello) are their own Client turns. Do not glue them onto the agent's next sentence.
- Keep local phrasing and code-switching verbatim (including isiZulu/Afrikaans). Only fix garble where the meaning is unambiguous.
- Mark anything you cannot make out as an inaudible acoustic event with a span. Do not guess words. A real auditor says "I couldn't hear that bit."
- dead_air = silence over 3 seconds inside the conversation. Log every one with its length and what preceded it.
- talk_over = both speakers audible at once for more than ~0.5s.
- tone_shift = an audible change in either speaker's manner. Describe what you heard, not what it means.
- Names: agent = self-intro ("you are speaking to Justin"). client = who they greet in the opening, with title ("Mr. Dube"). Ignore a later different surname if they already greeted someone. Never use Thank/Sir/Madam/Yebo/brands as a name. Otherwise "Unknown".
- observed_outcome is a factual description of how the call ended ("client said call me Thursday morning and hung up"), not a disposition code.
- Do not mention scores, grades, pass/fail, coaching, rubric categories, or whether the call was good or bad.

Return strict JSON only — no markdown fences.`;

const LISTEN_JSON_SHAPE = `{
  "duration_seconds": 0,
  "audio_quality": "clear",
  "inaudible_spans": [{ "start": 0, "end": 0 }],
  "transcript_segments": [
    { "speaker": "Agent", "start": 0, "end": 5.2, "text": "..." }
  ],
  "acoustic_events": [
    {
      "type": "dead_air",
      "start": 0,
      "end": 0,
      "speaker": "none",
      "detail": "8s of silence after client asked about the excess"
    }
  ],
  "delivery": {
    "agent_talk_ratio": 0.5,
    "agent_pace": "measured",
    "agent_tone": ["warm at open"],
    "client_tone": ["curious"],
    "longest_dead_air_seconds": 0,
    "talk_over_count": 0
  },
  "agent_name": "Unknown",
  "client_name": "Unknown",
  "observed_outcome": "plain description of how the call ended, no disposition code"
}`;

function geminiModelChain(preferred?: string): string[] {
  const fromEnv = (process.env.GEMINI_MODEL || "gemini-3.6-flash").trim();
  const chain = [
    preferred?.trim() || fromEnv,
    fromEnv,
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
  ];
  return [...new Set(chain.filter(Boolean))];
}

function mimeForAudio(audioPath: string): string {
  const ext = path.extname(audioPath).toLowerCase();
  const map: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
    ".webm": "audio/webm",
  };
  return map[ext] || "audio/mpeg";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : String(v ?? "").trim()))
    .filter(Boolean);
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asSpeaker(value: unknown): "Agent" | "Client" {
  const s = String(value || "").toLowerCase();
  if (
    s.includes("client") ||
    s.includes("customer") ||
    s.includes("caller") ||
    s.includes("prospect")
  ) {
    return "Client";
  }
  return "Agent";
}

function asEventSpeaker(value: unknown): AcousticEvent["speaker"] {
  const s = String(value || "").toLowerCase();
  if (s === "both") return "both";
  if (s === "none" || s === "" || s === "silence") return "none";
  if (s.includes("client") || s.includes("customer")) return "Client";
  if (s.includes("agent")) return "Agent";
  return "none";
}

const ACOUSTIC_TYPES: ReadonlySet<AcousticEvent["type"]> = new Set([
  "dead_air",
  "talk_over",
  "tone_shift",
  "inaudible",
  "hold",
  "background_noise",
]);

function parseAcousticEvents(raw: unknown): AcousticEvent[] {
  if (!Array.isArray(raw)) return [];
  const events: AcousticEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const type = String(rec.type || "") as AcousticEvent["type"];
    if (!ACOUSTIC_TYPES.has(type)) continue;
    const start = asFiniteNumber(rec.start);
    const end = asFiniteNumber(rec.end, start);
    events.push({
      type,
      start,
      end: end >= start ? end : start,
      speaker: asEventSpeaker(rec.speaker),
      detail: typeof rec.detail === "string" ? rec.detail.trim() : "",
    });
  }
  return events;
}

function parseInaudibleSpans(
  raw: unknown
): { start: number; end: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const rec = item as Record<string, unknown>;
      const start = asFiniteNumber(rec.start);
      const end = asFiniteNumber(rec.end, start);
      if (end <= start) return null;
      return { start, end };
    })
    .filter((s): s is { start: number; end: number } => s !== null);
}

function parseSegments(
  raw: unknown
): ListenPassResult["transcript_segments"] {
  if (!Array.isArray(raw)) return [];
  const segments: TranscriptSegment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const text = typeof rec.text === "string" ? rec.text.trim() : "";
    if (!text) continue;
    segments.push({
      speaker: asSpeaker(rec.speaker),
      start: asFiniteNumber(rec.start),
      end: asFiniteNumber(rec.end),
      text,
    });
  }
  return polishTranscript(segments).map((s) => ({
    speaker: s.speaker === "Client" ? "Client" : "Agent",
    start: s.start,
    end: s.end,
    text: s.text,
  }));
}

function parseAudioQuality(value: unknown): ListenPassResult["audio_quality"] {
  const s = String(value || "").toLowerCase();
  if (s === "poor") return "poor";
  if (s === "clear") return "clear";
  return "acceptable";
}

function parsePace(value: unknown): ListenPassResult["delivery"]["agent_pace"] {
  const s = String(value || "").toLowerCase();
  if (s === "rushed") return "rushed";
  if (s === "slow") return "slow";
  return "measured";
}

function clampRatio(value: unknown): number {
  const n = asFiniteNumber(value, 0.5);
  return Math.max(0, Math.min(1, n));
}

export function parseListenPassResult(
  raw: unknown,
  source: ListenPassResult["source"]
): ListenPassResult {
  const rec =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const segments = parseSegments(rec.transcript_segments);
  const durationFromSegs = segments.length
    ? Math.max(...segments.map((s) => s.end), 0)
    : 0;
  const deliveryRaw =
    rec.delivery && typeof rec.delivery === "object"
      ? (rec.delivery as Record<string, unknown>)
      : {};

  const inaudible = parseInaudibleSpans(rec.inaudible_spans);
  const events = parseAcousticEvents(rec.acoustic_events);

  for (const span of inaudible) {
    const already = events.some(
      (e) =>
        e.type === "inaudible" &&
        Math.abs(e.start - span.start) < 0.25 &&
        Math.abs(e.end - span.end) < 0.25
    );
    if (!already) {
      events.push({
        type: "inaudible",
        start: span.start,
        end: span.end,
        speaker: "none",
        detail: "Inaudible span",
      });
    }
  }

  const names = resolveCallNames({
    modelAgent: typeof rec.agent_name === "string" ? rec.agent_name : "",
    modelClient: typeof rec.client_name === "string" ? rec.client_name : "",
    transcript: segments,
  });

  return {
    source,
    duration_seconds:
      asFiniteNumber(rec.duration_seconds, durationFromSegs) || durationFromSegs,
    audio_quality: parseAudioQuality(rec.audio_quality),
    inaudible_spans: inaudible,
    transcript_segments: segments,
    acoustic_events: events,
    delivery: {
      agent_talk_ratio: clampRatio(deliveryRaw.agent_talk_ratio),
      agent_pace: parsePace(deliveryRaw.agent_pace),
      agent_tone: asStringArray(deliveryRaw.agent_tone),
      client_tone: asStringArray(deliveryRaw.client_tone),
      longest_dead_air_seconds: Math.max(
        0,
        asFiniteNumber(deliveryRaw.longest_dead_air_seconds)
      ),
      talk_over_count: Math.max(0, Math.round(asFiniteNumber(deliveryRaw.talk_over_count))),
    },
    agent_name: names.agent,
    client_name: names.client,
    observed_outcome:
      typeof rec.observed_outcome === "string" ? rec.observed_outcome.trim() : "",
  };
}

export function listenResultFromTranscript(
  segments: TranscriptSegment[],
  duration: number,
  names?: { agent?: string; client?: string }
): ListenPassResult {
  const polished = polishTranscript(segments).map((s) => ({
    speaker: (s.speaker === "Client" ? "Client" : "Agent") as "Agent" | "Client",
    start: s.start,
    end: s.end,
    text: s.text,
  }));
  const dur =
    duration > 0
      ? duration
      : polished.length
        ? Math.max(...polished.map((s) => s.end), 0)
        : 0;

  const resolved = resolveCallNames({
    modelAgent: names?.agent,
    modelClient: names?.client,
    transcript: polished,
    agentHint: names?.agent,
  });

  return {
    source: "transcript",
    duration_seconds: dur,
    audio_quality: "acceptable",
    inaudible_spans: [],
    transcript_segments: polished,
    acoustic_events: [],
    delivery: {
      agent_talk_ratio: 0,
      agent_pace: "measured",
      agent_tone: [],
      client_tone: [],
      longest_dead_air_seconds: 0,
      talk_over_count: 0,
    },
    agent_name: resolved.agent,
    client_name: resolved.client,
    observed_outcome: "",
  };
}

export async function runListenPass(
  audioPath: string,
  model?: string,
  hints?: { agentName?: string }
): Promise<ListenPassResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === "your-gemini-api-key") {
    throw new Error(
      "GEMINI_API_KEY is required for audio listening. Get a key at https://aistudio.google.com/apikey"
    );
  }

  const buffer = await fs.readFile(audioPath);
  const mimeType = mimeForAudio(audioPath);
  const audioPart = await buildAudioPart(apiKey, audioPath, mimeType, buffer);

  const hintLine = hints?.agentName?.trim()
    ? `\nUploader thinks the agent may be named ${hints.agentName.trim()}. Confirm from the audio — do not force it if you hear a different name.\n`
    : "";

  const userText = `Listen to this FULL call recording carefully. Take notes only — what was said, when, and what it sounded like. Do not score or coach.
${hintLine}
Write every turn through to the goodbye or drop. No summaries, no ellipsis.

Return JSON in this exact structure:
${LISTEN_JSON_SHAPE}`;

  console.log(
    `[listen] Gemini observing ${path.basename(audioPath)} (${Math.round(buffer.length / 1024)} KB)`
  );

  const response = await callGemini(
    apiKey,
    {
      systemInstruction: { parts: [{ text: LISTEN_PASS_SYSTEM_PROMPT }] },
      contents: [
        {
          role: "user",
          parts: [audioPart, { text: userText }],
        },
      ],
      generationConfig: {
        temperature: 0.0,
        topP: 0.1,
        responseMimeType: "application/json",
      },
    },
    { models: geminiModelChain(model), maxAttempts: 3 }
  );

  const text = extractGeminiText(response);
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed: unknown = JSON.parse(cleaned);
  const result = parseListenPassResult(parsed, "audio");
  if (hints?.agentName) {
    const resolved = resolveCallNames({
      modelAgent: result.agent_name,
      modelClient: result.client_name,
      transcript: result.transcript_segments,
      agentHint: hints.agentName,
    });
    result.agent_name = resolved.agent;
    result.client_name = resolved.client;
  }

  if (!result.transcript_segments.length) {
    throw new Error(
      "Listen pass returned no transcript segments — retry or check the audio file"
    );
  }

  return result;
}
