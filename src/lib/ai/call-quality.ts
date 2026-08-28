import {
  DISPOSITION_CODES,
  type DispositionCode,
} from "@/lib/utils";
import type { CampaignScorecard } from "@/lib/db/schema";
import type { TranscriptSegment, NormalizedAudit } from "./prompts";
import type { ListenPassResult } from "./listen-pass";

const NAME_BLOCKLIST = new Set([
  "unknown",
  "thank",
  "thanks",
  "calling",
  "hello",
  "hi",
  "good",
  "morning",
  "afternoon",
  "evening",
  "sorry",
  "please",
  "yes",
  "yeah",
  "okay",
  "ok",
  "sir",
  "madam",
  "maam",
  "ma'am",
  "miss",
  "customer",
  "client",
  "agent",
  "speaking",
  "company",
  "budget",
  "miway",
  "clientele",
  "smart",
  "not",
  "provided",
  "none",
  "n/a",
  "na",
  "yebo",
  "sawubona",
  "hallo",
  "how",
  "doing",
  "today",
  "later",
  "behalf",
  "recorded",
  "insurance",
  "ngiyaphila",
  "kindly",
  "note",
]);

const DISPOSITION_ALIASES: Record<string, DispositionCode> = {
  callback: "CALLBK",
  "call back": "CALLBK",
  "callback scheduled": "CALLBK",
  callbk: "CALLBK",
  "call cut": "CC",
  cut: "CC",
  disconnected: "CC",
  "call dropped": "CC",
  cc: "CC",
  cnp: "CNP",
  "callback no presentation": "CNP",
  dnc: "DNC",
  "do not call": "DNC",
  dnq: "DNQ",
  "did not qualify": "DNQ",
  dnqcv: "DNQCV",
  dnqnv: "DNQNV",
  dnqs: "DNQS",
  dnqu: "DNQU",
  lb: "LB",
  "language barrier": "LB",
  "no answer": "N",
  n: "N",
  ni: "NI",
  "not interested": "NI",
  noa: "NOA",
  "not available": "NOA",
  sale: "SALE",
  sold: "SALE",
  "sale completed": "SALE",
  ts: "TS",
  troubleshooter: "TS",
  v: "V",
  voicemail: "V",
  "voice mail": "V",
  wn: "WN",
  "wrong number": "WN",
};

const VALID_DISPOSITIONS = new Set<string>(DISPOSITION_CODES);

/** Clean a person name from model or regex output. */
export function cleanPersonName(raw: string | null | undefined): string {
  if (!raw) return "Unknown";
  let name = String(raw)
    .replace(/["'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  name = name.replace(/^(mr|mrs|ms|miss|dr)\.?\s+/i, (m) => {
    const title = m.trim().replace(/\.$/, "");
    const mapped =
      title.toLowerCase() === "mr"
        ? "Mr."
        : title.toLowerCase() === "mrs"
          ? "Mrs."
          : title.toLowerCase() === "ms" || title.toLowerCase() === "miss"
            ? "Ms."
            : "Dr.";
    return `${mapped} `;
  });

  // Drop trailing courtesy words
  name = name.replace(/[.,;:]+$/, "").trim();

  if (!name || /^unknown$/i.test(name)) return "Unknown";
  if (/^(not\s+provided|n\/a|none|null)$/i.test(name)) return "Unknown";

  const first = name.replace(/^(Mr|Mrs|Ms|Dr)\.\s+/i, "").split(/\s+/)[0];
  if (!first || NAME_BLOCKLIST.has(first.toLowerCase())) return "Unknown";
  if (first.length < 2) return "Unknown";
  if (/^\d+$/.test(first)) return "Unknown";

  // Title-case words
  return name
    .split(/\s+/)
    .map((w) => {
      if (/^(Mr|Mrs|Ms|Dr)\.?$/i.test(w)) {
        return w.replace(/\.$/, "") + ".";
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

export function normalizeDispositionCode(
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (/^(not\s+provided|n\/a|none|null|unknown|-)$/i.test(trimmed)) {
    return null;
  }

  const upper = trimmed.toUpperCase().replace(/\s+/g, "");
  if (VALID_DISPOSITIONS.has(upper)) return upper;

  // CODE — label
  const beforeDash = trimmed.split(/[—–-]/)[0]?.trim().toUpperCase();
  if (beforeDash && VALID_DISPOSITIONS.has(beforeDash)) return beforeDash;

  const alias = DISPOSITION_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;

  // Fuzzy contains
  const lower = trimmed.toLowerCase();
  for (const [key, code] of Object.entries(DISPOSITION_ALIASES)) {
    if (lower.includes(key)) return code;
  }

  return null;
}

const NAME_TOKEN = "([A-Za-z][A-Za-z''\\-]{1,30})";

function isTitledName(name: string): boolean {
  return /^(Mr|Mrs|Ms|Dr)\.\s+/i.test(name);
}

function nameCore(name: string): string {
  return cleanPersonName(name)
    .replace(/^(Mr|Mrs|Ms|Dr)\.\s+/i, "")
    .toLowerCase();
}

/** Keep the richer of two names for the same person (Mr. Dube > Dube). */
export function preferPersonName(primary: string, secondary: string): string {
  const a = cleanPersonName(primary);
  const b = cleanPersonName(secondary);
  if (a === "Unknown") return b;
  if (b === "Unknown") return a;
  const ca = nameCore(a);
  const cb = nameCore(b);
  if (ca === cb || ca.includes(cb) || cb.includes(ca)) {
    if (isTitledName(a) !== isTitledName(b)) {
      return isTitledName(a) ? a : b;
    }
    return a.length >= b.length ? a : b;
  }
  return a;
}

/**
 * Pull names from transcript phrases (backup when the model misses them).
 * Agent = self-intro. Client = who the agent addresses in the opening.
 */
export function extractNamesFromTranscript(segments: TranscriptSegment[]): {
  agent: string;
  client: string;
} {
  let agent = "Unknown";
  let client = "Unknown";

  const agentPatterns = [
    new RegExp(
      `(?:you are|you're)\\s+speaking\\s+(?:to|with)\\s+${NAME_TOKEN}`,
      "i"
    ),
    new RegExp(
      `(?:my name is|this is)\\s+${NAME_TOKEN}(?:\\s+(?:and|from|calling|on behalf))?`,
      "i"
    ),
    new RegExp(
      `speaking\\s+to\\s+${NAME_TOKEN}\\s+and\\s+I(?:'m| am)\\s+calling`,
      "i"
    ),
  ];
  const clientFromAgentPatterns = [
    new RegExp(
      `(?:am i speaking (?:to|with)|is this)\\s+(mr\\.?|mrs\\.?|ms\\.?|miss|ntate|mme)?\\s*${NAME_TOKEN}(?:\\s+${NAME_TOKEN})?`,
      "i"
    ),
    new RegExp(
      `good (?:morning|afternoon|day|evening),?\\s+(mr\\.?|mrs\\.?|ms\\.?|miss)?\\s*${NAME_TOKEN}`,
      "i"
    ),
    new RegExp(`^(mr\\.?|mrs\\.?|ms\\.?|miss)\\s+${NAME_TOKEN}\\b`, "i"),
  ];
  const clientSelfPatterns = [
    new RegExp(`(?:my name is|i am|i'm|this is)\\s+${NAME_TOKEN}`, "i"),
  ];

  const opening = segments.filter((s) => s.start <= 30);

  for (const seg of opening) {
    const text = seg.text || "";
    if (seg.speaker === "Agent") {
      if (agent === "Unknown") {
        for (const re of agentPatterns) {
          const m = text.match(re);
          if (!m) continue;
          const candidate = cleanPersonName(m[1]);
          if (
            candidate !== "Unknown" &&
            !/^(mr|mrs|ms|dr)\.?$/i.test(candidate.split(/\s+/)[0])
          ) {
            agent = candidate;
            break;
          }
        }
      }
      if (client === "Unknown") {
        for (const re of clientFromAgentPatterns) {
          const m = text.match(re);
          if (!m) continue;
          const titled = m[1] && /^(mr|mrs|ms|miss|ntate|mme)/i.test(m[1]);
          const person = titled ? `${m[1]} ${m[2]}` : m[2] || m[1];
          const candidate = cleanPersonName(person);
          if (
            candidate !== "Unknown" &&
            nameCore(candidate) !== nameCore(agent)
          ) {
            client = candidate;
            break;
          }
        }
      }
    }

    if (seg.speaker === "Client" && client === "Unknown") {
      for (const re of clientSelfPatterns) {
        const m = text.match(re);
        if (!m) continue;
        const candidate = cleanPersonName(m[1]);
        if (candidate !== "Unknown" && nameCore(candidate) !== nameCore(agent)) {
          client = candidate;
          break;
        }
      }
    }
  }

  if (agent === "Unknown") {
    for (const seg of segments) {
      if (seg.speaker !== "Agent") continue;
      for (const re of agentPatterns) {
        const m = (seg.text || "").match(re);
        if (!m) continue;
        const candidate = cleanPersonName(m[1]);
        if (candidate !== "Unknown") {
          agent = candidate;
          break;
        }
      }
      if (agent !== "Unknown") break;
    }
  }

  return { agent, client };
}

export function resolveCallNames(input: {
  modelAgent?: string | null;
  modelClient?: string | null;
  transcript: TranscriptSegment[];
  agentHint?: string | null;
}): { agent: string; client: string } {
  const extracted = extractNamesFromTranscript(input.transcript);
  const hint = cleanPersonName(input.agentHint);
  const agent =
    hint !== "Unknown"
      ? hint
      : preferPersonName(extracted.agent, input.modelAgent || "Unknown");
  const client = preferPersonName(
    extracted.client,
    input.modelClient || "Unknown"
  );
  return { agent, client };
}

/** Merge adjacent same-speaker turns and tidy timing/text. */
export function polishTranscript(
  segments: TranscriptSegment[]
): TranscriptSegment[] {
  if (!segments.length) return [];

  const cleaned = segments
    .map((s) => ({
      speaker: normalizeSpeaker(s.speaker),
      start: Math.max(0, Number(s.start) || 0),
      end: Math.max(0, Number(s.end) || 0),
      text: tidyUtterance(s.text),
    }))
    .filter((s) => s.text.length > 0)
    .map((s) => ({
      ...s,
      end: s.end > s.start ? s.end : s.start + Math.max(0.8, s.text.split(/\s+/).length * 0.35),
    }))
    .sort((a, b) => a.start - b.start);

  const merged: TranscriptSegment[] = [];
  for (const seg of cleaned) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.speaker === seg.speaker &&
      seg.start - prev.end <= 1.25
    ) {
      prev.text = `${prev.text} ${seg.text}`.replace(/\s+/g, " ").trim();
      prev.end = Math.max(prev.end, seg.end);
      continue;
    }
    merged.push({ ...seg });
  }

  // Ensure monotonic times
  for (let i = 1; i < merged.length; i++) {
    if (merged[i].start < merged[i - 1].start) {
      merged[i].start = merged[i - 1].end;
    }
    if (merged[i].end <= merged[i].start) {
      merged[i].end = merged[i].start + 0.8;
    }
  }

  return splitLongUtterances(merged);
}

function normalizeSpeaker(raw: string): "Agent" | "Client" {
  const s = String(raw || "").toLowerCase();
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

function tidyUtterance(text: string): string {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/([.!?])([A-Za-z])/g, "$1 $2")
    .replace(/\s*(?:\.{3,}|…)\s*$/g, "")
    .trim();
}

function splitLongUtterances(
  segments: TranscriptSegment[]
): TranscriptSegment[] {
  const out: TranscriptSegment[] = [];
  for (const seg of segments) {
    const words = seg.text.split(/\s+/).filter(Boolean);
    if (words.length <= 42) {
      out.push(seg);
      continue;
    }
    const sentences = seg.text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (sentences.length < 2) {
      out.push(seg);
      continue;
    }
    const totalWords = words.length || 1;
    const span = Math.max(0.8, seg.end - seg.start);
    let cursor = seg.start;
    let used = 0;
    sentences.forEach((sentence, i) => {
      const w = sentence.split(/\s+/).filter(Boolean).length;
      used += w;
      const end =
        i === sentences.length - 1
          ? seg.end
          : seg.start + (used / totalWords) * span;
      out.push({
        speaker: seg.speaker,
        start: cursor,
        end: Math.max(cursor + 0.6, end),
        text: sentence,
      });
      cursor = Math.max(cursor + 0.6, end);
    });
  }
  return out;
}

export function resolveDispositionMatch(
  agentSelected: string | null,
  recommended: string | null,
  modelMatch: boolean | null | undefined
): boolean | null {
  if (!agentSelected || !recommended) return null;
  if (agentSelected === recommended) return true;
  if (typeof modelMatch === "boolean") return modelMatch;
  return false;
}

const TIMESTAMP_RE = /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/g;

export function parseTimestampMarker(marker: string): number | null {
  const m = marker.match(/\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/);
  if (!m) return null;
  if (m[3] !== undefined) {
    const h = Number(m[1]);
    const min = Number(m[2]);
    const sec = Number(m[3]);
    if (![h, min, sec].every(Number.isFinite)) return null;
    return h * 3600 + min * 60 + sec;
  }
  const min = Number(m[1]);
  const sec = Number(m[2]);
  if (![min, sec].every(Number.isFinite)) return null;
  return min * 60 + sec;
}

function inInaudibleSpan(
  seconds: number,
  spans: { start: number; end: number }[]
): boolean {
  return spans.some((s) => seconds >= s.start && seconds <= s.end);
}

function sanitizeTimestampedText(
  text: string,
  duration: number,
  inaudible: { start: number; end: number }[],
  warnings: string[],
  field: string
): string {
  TIMESTAMP_RE.lastIndex = 0;
  return text.replace(TIMESTAMP_RE, (full) => {
    const seconds = parseTimestampMarker(full);
    if (seconds === null) {
      warnings.push(`${field}: could not parse timestamp ${full}`);
      return "";
    }
    if (duration > 0 && (seconds < 0 || seconds > duration + 0.75)) {
      warnings.push(
        `${field}: timestamp ${full} is outside call duration (${Math.round(duration)}s)`
      );
      return "";
    }
    if (inInaudibleSpan(seconds, inaudible)) {
      warnings.push(
        `${field}: timestamp ${full} falls inside an inaudible span`
      );
      return "";
    }
    return full;
  }).replace(/\s{2,}/g, " ").trim();
}

function hasTimestamp(text: string): boolean {
  TIMESTAMP_RE.lastIndex = 0;
  return TIMESTAMP_RE.test(text);
}

function mentions(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n));
}

function normalizePhrase(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Code-level QA integrity checks. Does not call an LLM.
 */
export function verifyAudit(
  audit: NormalizedAudit,
  listen: ListenPassResult,
  scorecard: CampaignScorecard
): { audit: NormalizedAudit; warnings: string[] } {
  const warnings: string[] = [...audit.integrityWarnings];
  const duration = listen.duration_seconds || audit.durationSeconds || 0;
  const inaudible = listen.inaudible_spans || [];

  const next: NormalizedAudit = {
    ...audit,
    whatWentWrong: audit.whatWentWrong.map((item, i) =>
      sanitizeTimestampedText(
        item,
        duration,
        inaudible,
        warnings,
        `what_went_wrong[${i}]`
      )
    ),
    whatWentWell: audit.whatWentWell.map((item, i) =>
      sanitizeTimestampedText(
        item,
        duration,
        inaudible,
        warnings,
        `what_went_well[${i}]`
      )
    ),
    rubric: { ...audit.rubric },
    scoreBreakdown: { ...audit.scoreBreakdown },
    complianceCheck: [...audit.complianceCheck],
  };

  for (const criterion of scorecard.criteria) {
    const entry = next.rubric[criterion.key] || {
      score: 0,
      max: criterion.max,
      notes: "",
    };
    const cleanedNotes = sanitizeTimestampedText(
      entry.notes,
      duration,
      inaudible,
      warnings,
      `score_breakdown_notes.${criterion.key}`
    );
    let score = entry.score;
    if (!Number.isFinite(score)) score = 0;
    if (score < 0 || score > criterion.max) {
      warnings.push(
        `${criterion.key}: score ${score} outside 0..${criterion.max}`
      );
      score = Math.max(0, Math.min(criterion.max, Math.round(score)));
    }
    if (!hasTimestamp(cleanedNotes)) {
      const adequate = Math.round(criterion.max / 2);
      if (score !== adequate) {
        warnings.push(
          `${criterion.key}: no cited [mm:ss] moment — scored at adequate anchor (${adequate}/${criterion.max})`
        );
        score = adequate;
      }
    }
    next.rubric[criterion.key] = {
      score,
      max: criterion.max,
      notes: cleanedNotes,
    };
    next.scoreBreakdown[criterion.key] = score;
  }

  const missingMandatory: string[] = [];
  for (const phrase of scorecard.mandatoryPhrases) {
    const found = next.complianceCheck.find(
      (c) => normalizePhrase(c.phrase) === normalizePhrase(phrase)
    );
    if (!found) {
      next.complianceCheck.push({
        phrase,
        status: "missing",
        timestamp: null,
      });
      warnings.push(
        `compliance_check missing for mandatory phrase: "${phrase}" (recorded as missing)`
      );
      missingMandatory.push(phrase);
    } else if (found.status === "missing") {
      missingMandatory.push(phrase);
    }
  }

  const complianceKey = scorecard.criteria.find(
    (c) => c.key === "verification_compliance"
  );
  if (complianceKey && missingMandatory.length > 0) {
    const cap = Math.floor(complianceKey.max / 2);
    const current = next.scoreBreakdown.verification_compliance ?? 0;
    if (current > cap) {
      warnings.push(
        `verification_compliance capped at ${cap} because mandatory phrases were missing`
      );
      next.scoreBreakdown.verification_compliance = cap;
      next.rubric.verification_compliance = {
        ...(next.rubric.verification_compliance || {
          max: complianceKey.max,
          notes: "",
        }),
        score: cap,
        max: complianceKey.max,
      };
    }
  }

  if (listen.source === "audio") {
    const wrongText = next.whatWentWrong.join(" ");
    if (listen.delivery.longest_dead_air_seconds > 5) {
      if (!mentions(wrongText, ["dead air", "silence", "went quiet", "pause"])) {
        warnings.push(
          `longest_dead_air_seconds is ${listen.delivery.longest_dead_air_seconds}s but what_went_wrong does not mention dead air/silence`
        );
      }
    }
    if (listen.delivery.talk_over_count >= 3) {
      if (
        !mentions(wrongText, [
          "talk-over",
          "talk over",
          "talkover",
          "interrupt",
          "spoke over",
          "overtalk",
        ])
      ) {
        warnings.push(
          `talk_over_count is ${listen.delivery.talk_over_count} but what_went_wrong does not mention talk-over`
        );
      }
    }
    if (
      listen.delivery.agent_talk_ratio > 0.75 ||
      listen.delivery.agent_talk_ratio < 0.35
    ) {
      if (
        !mentions(wrongText, [
          "talk ratio",
          "talk-time",
          "talk time",
          "dominated",
          "hardly spoke",
          "too much",
          "too little",
          "monologue",
        ])
      ) {
        warnings.push(
          `agent_talk_ratio is ${listen.delivery.agent_talk_ratio.toFixed(2)} but what_went_wrong does not mention talk-time imbalance`
        );
      }
    }
  }

  let summed = 0;
  for (const criterion of scorecard.criteria) {
    summed += next.scoreBreakdown[criterion.key] ?? 0;
  }
  next.overallScore = summed;
  next.grade =
    summed >= 90 ? "A" : summed >= 80 ? "B" : summed >= 70 ? "C" : summed >= 60 ? "D" : "F";
  next.passFail = summed >= 70 ? "pass" : "fail";
  next.integrityWarnings = warnings;

  return { audit: next, warnings };
}
