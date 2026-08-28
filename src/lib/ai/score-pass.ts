/**
 * Text-only score pass. Never sees the audio — works from listen-pass notes
 * plus the campaign scorecard, like a TL scoring from their notepad.
 */

import type { CampaignScorecard } from "@/lib/db/schema";
import type { ListenPassResult } from "./listen-pass";
import { callLlmJson } from "./llm-client";
import {
  type AuditLLMResponse,
  type NormalizedAudit,
  normalizeAuditResponse,
} from "./prompts";

function formatTime(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.floor(Math.max(0, seconds) % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function buildRubricBlock(scorecard: CampaignScorecard): string {
  return scorecard.criteria
    .map((c) => {
      const autoFail = c.autoFailIf
        ? `\nAuto-fail if: ${c.autoFailIf}`
        : "";
      return `${c.key} (0-${c.max}) — ${c.label}
What it covers: ${c.description}
Full marks sounds like: ${c.anchors.excellent}
Mid sounds like: ${c.anchors.adequate}
Low sounds like: ${c.anchors.poor}${autoFail}`;
    })
    .join("\n\n");
}

function buildDispositionGuide(scorecard: CampaignScorecard): string {
  return scorecard.dispositionCodes
    .map((d) => `- ${d.code}: ${d.label} — ${d.whenToUse}`)
    .join("\n");
}

function scoreBreakdownShape(scorecard: CampaignScorecard): string {
  const inner = scorecard.criteria
    .map((c) => `    "${c.key}": 0`)
    .join(",\n");
  const notes = scorecard.criteria
    .map((c) => `    "${c.key}": "[mm:ss] one-line justification"`)
    .join(",\n");
  return `{
  "score_breakdown": {
${inner}
  },
  "score_breakdown_notes": {
${notes}
  }
}`;
}

function buildAcousticEvidence(listen: ListenPassResult): string {
  if (listen.source === "transcript") {
    return `## Acoustic evidence
Delivery could NOT be assessed. These notes came from a transcript only — there is no audio listen.
Do not invent dead air, talk-over, pace, or tone. In what_went_wrong, team_leader_feedback, and manager_summary, state plainly that delivery could not be assessed from audio.
Do not score communication_clarity or call_control_ownership as if you heard the call; score them from wording only and say so in the notes.`;
  }

  const events =
    listen.acoustic_events.length === 0
      ? "(none logged)"
      : listen.acoustic_events
          .map(
            (e) =>
              `- [${formatTime(e.start)}–${formatTime(e.end)}] ${e.type} (${e.speaker}): ${e.detail}`
          )
          .join("\n");

  const inaudible =
    listen.inaudible_spans.length === 0
      ? "(none)"
      : listen.inaudible_spans
          .map((s) => `- [${formatTime(s.start)}–${formatTime(s.end)}]`)
          .join("\n");

  return `## Acoustic evidence the auditor heard (not optional colour — this is evidence)
Audio quality: ${listen.audio_quality}
Agent talk ratio: ${listen.delivery.agent_talk_ratio.toFixed(2)} (share of speaking time)
Agent pace: ${listen.delivery.agent_pace}
Agent tone: ${listen.delivery.agent_tone.join("; ") || "(not noted)"}
Client tone: ${listen.delivery.client_tone.join("; ") || "(not noted)"}
Longest dead air: ${listen.delivery.longest_dead_air_seconds}s
Talk-over count: ${listen.delivery.talk_over_count}

Acoustic events:
${events}

Inaudible spans:
${inaudible}`;
}

function buildHardRules(listen: ListenPassResult): string {
  if (listen.source === "transcript") {
    return `## Hard rules
Transcript-only path: do not treat missing acoustics as a clean call.`;
  }

  const triggers: string[] = [];
  if (listen.delivery.longest_dead_air_seconds > 5) {
    triggers.push(
      `longest_dead_air_seconds is ${listen.delivery.longest_dead_air_seconds} (> 5). You MUST address this dead air by name in what_went_wrong with the timestamp.`
    );
  }
  if (listen.delivery.talk_over_count >= 3) {
    triggers.push(
      `talk_over_count is ${listen.delivery.talk_over_count} (>= 3). You MUST address talk-over by name in what_went_wrong with a timestamp.`
    );
  }
  if (
    listen.delivery.agent_talk_ratio > 0.75 ||
    listen.delivery.agent_talk_ratio < 0.35
  ) {
    triggers.push(
      `agent_talk_ratio is ${listen.delivery.agent_talk_ratio.toFixed(2)} (outside 0.35–0.75). You MUST address talk-time imbalance by name in what_went_wrong with a timestamp.`
    );
  }

  const triggerBlock =
    triggers.length > 0
      ? `Triggered acoustic rules (mandatory):\n${triggers.map((t) => `- ${t}`).join("\n")}`
      : `No acoustic hard-rule thresholds were crossed. Still cite delivery where it is relevant.`;

  return `## Hard rules
${triggerBlock}
- call_control_ownership AND communication_clarity notes MUST each cite at least one acoustic event or delivery metric. A score on those two categories with no acoustic evidence is invalid.
- If audio_quality is "poor" or an inaudible span overlaps a scored moment, say so and score conservatively. Do not invent what was said.`;
}

function buildComplianceBlock(scorecard: CampaignScorecard): string {
  const mandatory =
    scorecard.mandatoryPhrases.length === 0
      ? "(none configured)"
      : scorecard.mandatoryPhrases.map((p) => `- ${p}`).join("\n");
  const prohibited =
    scorecard.prohibitedClaims.length === 0
      ? "(none configured)"
      : scorecard.prohibitedClaims.map((p) => `- ${p}`).join("\n");
  const script = scorecard.scriptText.trim()
    ? scorecard.scriptText.trim()
    : "(no campaign script pasted)";

  return `## Campaign script (reference, not a cage)
An agent who covers the substance in their own words scores full marks. Only flag deviation where it lost information or breached compliance. Do not punish a natural-sounding agent for not reading the script verbatim.

${script}

## Mandatory phrases
Check each entry against the transcript. Report each as said / paraphrased / missing with a timestamp in compliance_check.
Missing mandatory phrases cap verification_compliance at half marks (floor: 0, ceiling: half of that category's max).

${mandatory}

## Prohibited claims
Any match is called out in what_went_wrong regardless of how well the rest of the call went.

${prohibited}`;
}

function buildSystemPrompt(scorecard: CampaignScorecard): string {
  const keys = scorecard.criteria.map((c) => c.key).join(", ");
  return `You are an experienced call-center Team Leader doing QA from written listen notes. You did not hear the audio yourself. You may only use the notes, transcript, acoustic evidence, and the QA form below. Do not invent moments that are not in the notes.

Mindset:
- Score the form in front of you. Every mark has a moment attached.
- Be fair, direct, and human. No robotic filler.
- Cite moments with timestamps like [1:24] and short quotes from the transcript.

Names:
- agent_name is the agent's self-intro ("you are speaking to Justin"), not "Am I speaking to…".
- client_name is who they greet in the opening, with title if heard ("Mr. Dube"). Do not swap in a later different surname.
- Copy the listen-pass names unless the transcript clearly contradicts them.

Scoring rules (do not break these):
- Score each category independently, in this fixed order, BEFORE computing any total: ${keys}
- Do not grade on a curve. Do not soften a score because the rest of the call was good. Do not inflate because the agent sounded pleasant.
- overall_score MUST equal the sum of score_breakdown.
- Every category score must be justified by a [mm:ss] moment in score_breakdown_notes. A category with no cited moment MUST be scored at the adequate (mid) anchor, not guessed high or low.
- grade: A (90+), B (80-89), C (70-79), D (60-69), F (<60)
- pass_fail: "pass" if overall_score >= 70 else "fail"
- If the agent did not select a disposition, set agent_selected_disposition to "" and disposition_match to null.
- Never invent a disposition. Use only the codes listed for this campaign.

Disposition codes:
${buildDispositionGuide(scorecard)}

QA form for this campaign (${scorecard.name}):
${buildRubricBlock(scorecard)}

team_leader_feedback:
Write as a team leader speaking to this agent at their desk, right after the call. 8–14 sentences. Use their name if you have it. Open with the specific thing they did well and quote it. Then the main problem, with the moment it happened — "at 2:14 you went quiet for eight seconds after she asked about the excess, and that's where you lost her." Then exactly what to say next time, in words the agent would actually use. Close with the one thing to fix on the next call.

Do not use the words: leverage, utilize, robust, synergy, moving forward, going forward, at the end of the day, circle back. Do not open with "Overall" or "Great job". Do not write a bulleted list. Do not praise something you cannot point to a timestamp for. If the call was bad, say so plainly and kindly — a TL who softens everything is useless to the agent.

manager_summary: two sentences, blunt, for the QA manager rather than the agent. Different audience, different register.

Return strict JSON only — no markdown fences.`;
}

function buildUserPrompt(
  listen: ListenPassResult,
  scorecard: CampaignScorecard,
  agentDisposition: string | null
): string {
  const transcript = listen.transcript_segments
    .map(
      (s) =>
        `[${formatTime(s.start)} - ${formatTime(s.end)}] ${s.speaker}: ${s.text}`
    )
    .join("\n");

  const notesShape = scoreBreakdownShape(scorecard);

  return `## Listen-pass notes
Duration: ${listen.duration_seconds}s
Observed agent name: ${listen.agent_name}
Observed client name: ${listen.client_name}
Observed outcome (not a disposition code): ${listen.observed_outcome || "(not noted)"}

## Transcript
${transcript || "(empty)"}

${buildAcousticEvidence(listen)}

${buildHardRules(listen)}

${buildComplianceBlock(scorecard)}

## Agent selected disposition
${agentDisposition?.trim() || "(none provided — leave agent_selected_disposition as empty string and disposition_match as null)"}

## JSON shape
{
  "summary": "2-4 sentences as if you just finished the notes — what happened and outcome",
  "agent_name": "name if clearly stated else Unknown",
  "client_name": "name if clearly stated else Unknown",
  "agent_selected_disposition": "exact code or empty string",
  "recommended_disposition": "exact disposition code from this campaign",
  "disposition_match": null,
  "disposition_rationale": "why the recommended code is correct",
  "what_went_wrong": ["[mm:ss] Specific miss with a short quote or moment"],
  "what_went_well": ["[mm:ss] Specific strength with evidence"],
  "what_should_have_been_done": ["Concrete alternative the agent should have said/done"],
  "focus_areas": ["1-3 coaching focus areas for the next shift"],
  "team_leader_feedback": "8-14 sentence desk-side paragraph",
  "immediate_coaching_notes": "Short notes for today's huddle",
  "priority_improvement_focus": "The single most important thing to fix next",
  "manager_summary": "Two blunt sentences for the QA manager",
  "compliance_check": [
    { "phrase": "mandatory phrase", "status": "said", "timestamp": "[0:12]" }
  ],
  "overall_score": 0,
  "grade": "",
  "pass_fail": ""
}

Include score_breakdown and score_breakdown_notes exactly like:
${notesShape}

Return JSON only.`;
}

export async function runScorePass(
  listen: ListenPassResult,
  scorecard: CampaignScorecard,
  agentDisposition: string | null,
  model?: string
): Promise<NormalizedAudit> {
  const systemPrompt = buildSystemPrompt(scorecard);
  const userPrompt = buildUserPrompt(listen, scorecard, agentDisposition);
  const raw = await callLlmJson(systemPrompt, userPrompt, model);
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(cleaned) as AuditLLMResponse;

  if (!parsed.agent_name) parsed.agent_name = listen.agent_name;
  if (!parsed.client_name) parsed.client_name = listen.client_name;
  parsed.duration_seconds = listen.duration_seconds;
  parsed.transcript_segments = listen.transcript_segments;

  return normalizeAuditResponse(parsed, agentDisposition, scorecard);
}
