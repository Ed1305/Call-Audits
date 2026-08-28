import { DISPOSITION_CODES, DISPOSITION_LABELS } from "@/lib/utils";
import type { CampaignScorecard } from "@/lib/db/schema";
import {
  cleanPersonName,
  extractNamesFromTranscript,
  preferPersonName,
  normalizeDispositionCode,
  polishTranscript,
  resolveDispositionMatch,
} from "./call-quality";

const DISPOSITION_GUIDE = DISPOSITION_CODES.map(
  (code) => `- ${code}: ${DISPOSITION_LABELS[code]}`
).join("\n");

const DISPOSITION_DECISION_TREE = `Disposition decision tree (pick ONE code — be decisive):
1. Voicemail / automated greeting only → V
2. No human answer / ringing out → N
3. Wrong person / wrong number → WN
4. Customer asks not to be called again → DNC
5. Language barrier prevents the pitch → LB
6. Line drops / customer hangs up mid-call before a clear outcome → CC
7. Customer clearly not interested / already covered and refuses → NI
8. Customer not available now but no firm callback time → NOA
9. Callback agreed with time/window after some pitch → CALLBK
10. Callback agreed but almost no product presentation → CNP
11. Did not qualify (generic) → DNQ
    - car value issue → DNQCV
    - no vehicle → DNQNV
    - salary band → DNQS
    - unemployed → DNQU
12. Sale / application completed → SALE
13. Technical / process troubleshooting handoff → TS

Never invent a disposition. Never output labels like "Not provided" — use "" if the agent did not select one.`;

const RUBRIC_BLOCK = `Scoring rubric (strict but fair — score only what you heard):
- opening_greeting: /10
- verification_compliance: /10
- understanding_probing: /15
- communication_clarity: /10
- empathy_professionalism: /10
- resolution_accuracy: /20
- call_control_ownership: /10
- disposition_accuracy: /10
- closing_next_steps: /5

overall_score MUST equal the sum of score_breakdown (max 100).
grade: A (90+), B (80-89), C (70-79), D (60-69), F (<60)
pass_fail: "pass" if overall_score >= 70 else "fail"`;

const NAME_RULES = `Name capture rules (critical):
- agent_name: the agent's SELF-intro only — "you are speaking to Justin", "my name is…", "this is… and I'm calling". First name is enough.
- client_name: who the agent addresses in the OPENING (first ~20s) — "Good morning, Mr Dube", "Am I speaking to Mrs Khumalo". Keep the title (Mr./Mrs./Ms.).
- Do not take a later slip ("Mr Mthethwa" after already greeting Mr Dube) as a new client name.
- Never use "Thank", "Sir", "Madam", "Yebo", company brands (MiWay, Smart Budget, Clientele), or campaign words as names.
- If not clearly spoken, return exactly "Unknown" — do not guess.`;

const JSON_SHAPE = `{
  "summary": "2-4 sentences as if you just finished listening — what happened and outcome",
  "agent_name": "name if clearly stated else Unknown",
  "client_name": "name if clearly stated else Unknown",
  "agent_selected_disposition": "exact code or empty string",
  "recommended_disposition": "exact disposition code",
  "disposition_match": null,
  "disposition_rationale": "why the recommended code is correct; compare to agent selection if present",
  "what_went_wrong": ["[mm:ss] Specific miss with a short quote or moment"],
  "what_went_well": ["[mm:ss] Specific strength with evidence"],
  "what_should_have_been_done": ["Concrete alternative the agent should have said/done"],
  "focus_areas": ["1-3 coaching focus areas for the next shift"],
  "team_leader_feedback": "Natural spoken feedback to the agent (8-14 sentences). Sound human. Mix praise and correction. Reference moments on the call.",
  "immediate_coaching_notes": "Short notes for today's huddle — practical, not corporate",
  "priority_improvement_focus": "The single most important thing to fix next",
  "manager_summary": "Two blunt sentences for the QA manager, not the agent",
  "compliance_check": [
    { "phrase": "mandatory phrase", "status": "said", "timestamp": "[0:12]" }
  ],
  "score_breakdown_notes": {
    "opening_greeting": "[0:04] Gave name and company but skipped the recording disclosure"
  },
  "score_breakdown": {
    "opening_greeting": 0,
    "verification_compliance": 0,
    "understanding_probing": 0,
    "communication_clarity": 0,
    "empathy_professionalism": 0,
    "resolution_accuracy": 0,
    "call_control_ownership": 0,
    "disposition_accuracy": 0,
    "closing_next_steps": 0
  },
  "overall_score": 0,
  "grade": "",
  "pass_fail": ""
}`;

/** Transcript-based audit (OpenAI / Ollama) — still written as a listening TL */
export const AUDIT_SYSTEM_PROMPT = `You are an experienced call-center Team Leader doing live QA on outbound/inbound sales and service calls (often insurance / financial services in South Africa).

Read the transcript as if you are listening with headphones — turn by turn. Notice dead air, interruptions, soft skills, compliance, and whether the agent secured a clear outcome.

Mindset:
- Coach a real agent after sitting with their call.
- Be fair, direct, and human. No robotic filler. No inventing details.
- Cite moments with timestamps like [1:24] and short quotes.
- Judge agent performance, not just the plot.

${NAME_RULES}

${DISPOSITION_DECISION_TREE}

Disposition codes (use ONLY these exact codes):
${DISPOSITION_GUIDE}

If the agent did not select a disposition, set agent_selected_disposition to "" and disposition_match to null.

${RUBRIC_BLOCK}

Return JSON in this exact structure:
${JSON_SHAPE}`;

/** @deprecated Audio observation now lives in listen-pass.ts; scoring in score-pass.ts. */
export const AUDIO_LISTEN_SYSTEM_PROMPT = AUDIT_SYSTEM_PROMPT;

export type ComplianceStatus = "said" | "paraphrased" | "missing";

export interface ComplianceCheckItem {
  phrase: string;
  status: ComplianceStatus;
  timestamp: string | null;
}

export interface AuditLLMResponse {
  summary: string;
  agent_name: string;
  client_name: string;
  agent_selected_disposition: string;
  recommended_disposition: string;
  disposition_match: boolean | null;
  disposition_rationale: string;
  what_went_wrong: string[];
  what_went_well: string[];
  what_should_have_been_done: string[];
  focus_areas: string[];
  team_leader_feedback: string;
  immediate_coaching_notes: string;
  priority_improvement_focus: string;
  manager_summary?: string;
  compliance_check?: ComplianceCheckItem[];
  score_breakdown_notes?: Record<string, string>;
  score_breakdown: Record<string, number>;
  overall_score: number;
  grade: string;
  pass_fail: string;
  duration_seconds?: number;
  transcript_segments?: TranscriptSegment[];
}

export interface NormalizedAudit {
  summary: string;
  agentName: string;
  clientName: string;
  agentSelectedDisposition: string;
  recommendedDisposition: string;
  dispositionMatch: boolean | null;
  dispositionRationale: string;
  whatWentWrong: string[];
  whatWentWell: string[];
  whatShouldHaveBeenDone: string[];
  focusAreas: string[];
  teamLeaderFeedback: string;
  immediateCoachingNotes: string;
  priorityImprovementFocus: string;
  managerSummary: string;
  complianceCheck: ComplianceCheckItem[];
  scoreBreakdown: Record<string, number>;
  rubric: Record<string, { score: number; max: number; notes: string }>;
  overallScore: number;
  grade: string;
  passFail: string;
  integrityWarnings: string[];
  raw: AuditLLMResponse;
  durationSeconds?: number;
  transcriptSegments?: TranscriptSegment[];
}

export interface TranscriptSegment {
  speaker: string;
  start: number;
  end: number;
  text: string;
}

export interface ProcessingResult {
  duration: number;
  segments: TranscriptSegment[];
  participants: {
    agent: { name: string; confidence: number };
    client: { name: string; confidence: number };
  };
}

export const RUBRIC_MAX: Record<string, number> = {
  opening_greeting: 10,
  verification_compliance: 10,
  understanding_probing: 15,
  communication_clarity: 10,
  empathy_professionalism: 10,
  resolution_accuracy: 20,
  call_control_ownership: 10,
  disposition_accuracy: 10,
  closing_next_steps: 5,
};

export function rubricMaxFromScorecard(
  scorecard?: CampaignScorecard | null
): Record<string, number> {
  if (scorecard?.criteria?.length) {
    const map: Record<string, number> = {};
    for (const c of scorecard.criteria) {
      map[c.key] = c.max;
    }
    return map;
  }
  return { ...RUBRIC_MAX };
}

function clampScore(score: number, max: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(max, Math.round(score)));
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : String(v ?? "").trim()))
    .filter(Boolean);
}

function parseComplianceCheck(raw: unknown): ComplianceCheckItem[] {
  if (!Array.isArray(raw)) return [];
  const items: ComplianceCheckItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const phrase = typeof rec.phrase === "string" ? rec.phrase.trim() : "";
    if (!phrase) continue;
    const statusRaw = String(rec.status || "").toLowerCase();
    const status: ComplianceStatus =
      statusRaw === "said" || statusRaw === "paraphrased" || statusRaw === "missing"
        ? statusRaw
        : "missing";
    const timestamp =
      typeof rec.timestamp === "string" && rec.timestamp.trim()
        ? rec.timestamp.trim()
        : null;
    items.push({ phrase, status, timestamp });
  }
  return items;
}

function parseNotesMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && value.trim()) {
      out[key] = value.trim();
    }
  }
  return out;
}

export function gradeFromScore(overallScore: number): string {
  if (overallScore >= 90) return "A";
  if (overallScore >= 80) return "B";
  if (overallScore >= 70) return "C";
  if (overallScore >= 60) return "D";
  return "F";
}

export function normalizeAuditResponse(
  parsed: AuditLLMResponse,
  fallbackDisposition: string | null,
  scorecard?: CampaignScorecard | null
): NormalizedAudit {
  const maxes = rubricMaxFromScorecard(scorecard);
  const notesMap = parseNotesMap(parsed.score_breakdown_notes);
  const scoreBreakdown: Record<string, number> = {};
  let summed = 0;
  for (const [key, max] of Object.entries(maxes)) {
    const raw = parsed.score_breakdown?.[key] ?? 0;
    const score = clampScore(Number(raw), max);
    scoreBreakdown[key] = score;
    summed += score;
  }

  const overallScore = summed;
  const grade = parsed.grade || gradeFromScore(overallScore);
  const passFail =
    parsed.pass_fail || (overallScore >= 70 ? "pass" : "fail");

  const rubric: Record<string, { score: number; max: number; notes: string }> =
    {};
  for (const [key, max] of Object.entries(maxes)) {
    rubric[key] = {
      score: scoreBreakdown[key] ?? 0,
      max,
      notes: notesMap[key] || "",
    };
  }

  const rawSegments = Array.isArray(parsed.transcript_segments)
    ? parsed.transcript_segments.filter(
        (s) =>
          s &&
          typeof s.text === "string" &&
          s.text.trim() &&
          typeof s.start === "number" &&
          typeof s.end === "number"
      )
    : [];

  const transcriptSegments = rawSegments.length
    ? polishTranscript(rawSegments)
    : undefined;

  let agentName = cleanPersonName(parsed.agent_name);
  let clientName = cleanPersonName(parsed.client_name);
  if (transcriptSegments) {
    const resolved = extractNamesFromTranscript(transcriptSegments);
    agentName = preferPersonName(resolved.agent, agentName);
    clientName = preferPersonName(resolved.client, clientName);
  }

  const agentSelectedDisposition =
    normalizeDispositionCode(parsed.agent_selected_disposition) ||
    normalizeDispositionCode(fallbackDisposition) ||
    "";

  const recommendedDisposition =
    normalizeDispositionCode(parsed.recommended_disposition) || "";

  const dispositionMatch = resolveDispositionMatch(
    agentSelectedDisposition || null,
    recommendedDisposition || null,
    parsed.disposition_match
  );

  const durationSeconds =
    typeof parsed.duration_seconds === "number" && parsed.duration_seconds > 0
      ? parsed.duration_seconds
      : transcriptSegments?.length
        ? Math.max(...transcriptSegments.map((s) => s.end))
        : undefined;

  return {
    summary: (parsed.summary || "").trim(),
    agentName,
    clientName,
    agentSelectedDisposition,
    recommendedDisposition,
    dispositionMatch,
    dispositionRationale: (parsed.disposition_rationale || "").trim(),
    whatWentWrong: asStringArray(parsed.what_went_wrong),
    whatWentWell: asStringArray(parsed.what_went_well),
    whatShouldHaveBeenDone: asStringArray(parsed.what_should_have_been_done),
    focusAreas: asStringArray(parsed.focus_areas),
    teamLeaderFeedback: (parsed.team_leader_feedback || "").trim(),
    immediateCoachingNotes: (parsed.immediate_coaching_notes || "").trim(),
    priorityImprovementFocus: (parsed.priority_improvement_focus || "").trim(),
    managerSummary: (parsed.manager_summary || "").trim(),
    complianceCheck: parseComplianceCheck(parsed.compliance_check),
    scoreBreakdown,
    rubric,
    overallScore,
    grade,
    passFail,
    integrityWarnings: [],
    raw: parsed,
    durationSeconds,
    transcriptSegments,
  };
}
