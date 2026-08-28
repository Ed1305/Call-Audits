# Cursor prompt — upgrade CallAudit to a real-person listening auditor

Paste everything below the line into Cursor (Agent mode, on the `Call_Audit` repo).

---

You are working on the CallAudit AI repo (Next.js 15 + TypeScript, JSON file store, Gemini audio-listen path already wired in `src/lib/ai/`).

Right now `AUDIO_LISTEN_SYSTEM_PROMPT` in `src/lib/ai/prompts.ts` does everything in one Gemini call: hear the audio, diarize, judge, and score. That's why the scoring drifts between runs, why the audio layer (dead air, talk-over, pace) never makes it into the feedback, and why the rubric is generic instead of scored against our real QA form.

Fix it with **surgical, targeted edits** — do not rewrite files wholesale, do not restyle the Ubuntu/Yaru UI, do not replace the JSON store with a real DB, and do not touch the upload flow in `src/app/api/calls/upload/route.ts` beyond what's listed below.

## What "listens like a real person" means here

A human QA auditor does three separate things, in order, and never mixes them:

1. **Listens and takes notes.** No opinions yet — just what was said, when, and what it sounded like.
2. **Scores against the QA form in front of them.** Every mark has a moment attached.
3. **Writes coaching feedback** from those notes and marks.

We're going to make the app do exactly that: three passes instead of one.

---

## Change 1 — Split the single Gemini call into two LLM passes

Create `src/lib/ai/listen-pass.ts`:

- Exports `runListenPass(audioPath: string, model): Promise<ListenPassResult>`
- Uses the existing Gemini file-upload/inline-audio plumbing from `src/lib/ai/gemini.ts` — reuse it, don't duplicate it. Keep the retry logic in `gemini-retry.ts`.
- **Temperature 0.0**, `topP: 0.1`, `responseMimeType: "application/json"`.
- Its system prompt must contain **no rubric, no scoring, no judgment language, no coaching**. If the model is thinking about scores while transcribing, the transcript bends to fit the score. This pass only observes.

Its JSON output shape:

```ts
export interface AcousticEvent {
  type: "dead_air" | "talk_over" | "tone_shift" | "inaudible" | "hold" | "background_noise";
  start: number;          // seconds
  end: number;
  speaker: "Agent" | "Client" | "both" | "none";
  detail: string;         // "8s of silence after client asked about the excess"
}

export interface ListenPassResult {
  duration_seconds: number;
  audio_quality: "clear" | "acceptable" | "poor";
  inaudible_spans: { start: number; end: number }[];
  transcript_segments: { speaker: "Agent" | "Client"; start: number; end: number; text: string }[];
  acoustic_events: AcousticEvent[];
  delivery: {
    agent_talk_ratio: number;        // 0-1, share of speaking time
    agent_pace: "rushed" | "measured" | "slow";
    agent_tone: string[];            // e.g. ["warm at open", "flat after objection", "impatient at close"]
    client_tone: string[];
    longest_dead_air_seconds: number;
    talk_over_count: number;
  };
  agent_name: string;   // "Unknown" if not clearly spoken
  client_name: string;  // "Unknown" if not clearly spoken
  observed_outcome: string;  // plain description of how the call ended, NO disposition code
}
```

Prompt rules for the listen pass:

- Diarize as `Agent` / `Client` (never Speaker 1/2). The agent is whoever opens with a company/brand and drives the pitch.
- Transcribe the **whole call**, greeting to drop. Do not summarise the middle.
- Keep local phrasing and code-switching verbatim. Only fix garble where the meaning is unambiguous.
- Mark anything you cannot make out as an `inaudible` acoustic event with a span — **do not guess words**. A real auditor says "I couldn't hear that bit."
- `dead_air` = silence over 3 seconds inside the conversation. Log every one with its length and what preceded it.
- `talk_over` = both speakers audible at once for more than ~0.5s.
- `tone_shift` = an audible change in either speaker's manner. Describe what you heard, not what it means.
- Names only when clearly spoken. Never use "Thank", "Sir", "Madam", or brand names (MiWay, Clientele, Smart Budget) as a name. Otherwise `"Unknown"`.
- `observed_outcome` is a factual description ("client said call me Thursday morning and hung up"), not a code.

Then create `src/lib/ai/score-pass.ts`:

- Exports `runScorePass(listen: ListenPassResult, scorecard: CampaignScorecard, agentDisposition: string | null, model)`
- **Text-only** — this pass never sees the audio, it works from the listen-pass JSON exactly like a TL working from their notes. Cheaper, and it forces every claim to be traceable to something the listen pass actually recorded.
- Temperature 0.0.
- Reuses the existing `AuditLLMResponse` / `normalizeAuditResponse` contract in `prompts.ts` so nothing downstream breaks — but it now also receives the acoustic evidence.

Rewire `src/lib/processing/pipeline.ts` to call listen → score in sequence, and update the `UploadStatus` progression in `src/lib/db/schema.ts` to `uploaded → listening → analyzing → completed` (drop `transcribing`/`diarizing` from the Gemini path, keep them for the Whisper path). Update `src/app/calls/[id]/processing/page.tsx` so the status labels match.

---

## Change 2 — Make the acoustic layer actually reach the feedback

The score pass must be *forced* to use it, not merely allowed to. In its prompt:

- The `delivery` and `acoustic_events` blocks are injected as **evidence the auditor heard**, listed explicitly.
- Rule: *if `longest_dead_air_seconds` exceeds 5, or `talk_over_count` is 3 or more, or `agent_talk_ratio` is above 0.75 or below 0.35, the audit MUST address it by name in `what_went_wrong` with the timestamp.* These are not optional observations.
- `call_control_ownership` and `communication_clarity` scores must each cite at least one acoustic event or delivery metric in their notes. A score on those two categories with no acoustic evidence is invalid.
- Where `audio_quality` is `"poor"` or an inaudible span overlaps a scored moment, the auditor says so and scores conservatively rather than inventing what was said.

Add per-category notes to the rubric output — extend the JSON shape with:

```ts
"score_breakdown_notes": {
  "opening_greeting": "[0:04] Gave name and company but skipped the recording disclosure",
  // ...one line per category, each with a [mm:ss] anchor
}
```

and surface those notes in the rubric table on `src/app/calls/[id]/page.tsx` and in the PDF (`src/lib/pdf/generate-pdf.ts`). `normalizeAuditResponse` already builds a `rubric` map with an empty `notes` field — populate it from this instead of leaving it blank.

---

## Change 3 — Score against our real QA form, not a generic rubric

Add a campaign scorecard concept.

In `src/lib/db/schema.ts`:

```ts
export interface RubricCriterion {
  key: string;
  label: string;
  max: number;
  description: string;      // what this category covers
  anchors: {                // THE fix for score drift
    excellent: string;      // what full marks sounds like on this campaign
    adequate: string;       // what a mid score sounds like
    poor: string;           // what a low score sounds like
  };
  autoFailIf?: string;      // optional: compliance line that zeroes the call
}

export interface CampaignScorecard {
  id: string;
  name: string;                 // "MiWay Outbound Q3"
  scriptText: string;           // the actual campaign script, pasted in
  mandatoryPhrases: string[];   // compliance lines that must be said verbatim-ish
  prohibitedClaims: string[];   // things the agent must never promise
  criteria: RubricCriterion[];  // sums to 100
  dispositionCodes: { code: string; label: string; whenToUse: string }[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
```

Store scorecards in the existing JSON store (`src/lib/db/index.ts`) — same pattern as the other collections. Seed one default scorecard from the current hardcoded `RUBRIC_MAX` and `DISPOSITION_CODES` so nothing breaks on first run.

Add a **Scorecards** section to `src/app/settings/page.tsx`, in the existing Ubuntu/Yaru style:

- List scorecards, create/edit/delete, mark one default.
- A large textarea for `scriptText`, list editors for `mandatoryPhrases` and `prohibitedClaims`.
- Per-criterion editor with the three anchor fields.
- Validate on save that `criteria` max values sum to exactly 100 — block the save with a toast if not.
- New API routes under `src/app/api/scorecards/`.

Add a scorecard selector to `src/app/upload/page.tsx` next to the disposition field, defaulting to the default scorecard. Store `scorecardId` on `CallRecord`.

Then in `score-pass.ts`, build the rubric block **from the selected scorecard at runtime** — the anchors go into the prompt verbatim:

```
verification_compliance (0-10)
What it covers: <description>
Full marks sounds like: <anchors.excellent>
Mid sounds like: <anchors.adequate>
Low sounds like: <anchors.poor>
```

Also inject the script text and compliance lists, with these rules:

- Check each `mandatoryPhrases` entry against the transcript. Report each as `said` / `paraphrased` / `missing` with a timestamp, in a new `compliance_check` array in the output. Missing mandatory phrases cap `verification_compliance` at half marks.
- Any `prohibitedClaims` match is called out in `what_went_wrong` regardless of how well the rest of the call went.
- The script is a **reference, not a cage**: an agent who covers the substance in their own words scores full marks. Only flag deviation where it lost information or breached compliance. Say this explicitly in the prompt — otherwise the model punishes natural-sounding agents, which is the opposite of what we want.

---

## Change 4 — Kill the score drift

In `score-pass.ts`, before returning:

- Temperature 0.0 on both passes (stated above, enforce it).
- The prompt instructs: **score each category independently, in the fixed order given, before computing any total.** No adjusting a category to hit a target overall score.
- Explicit instruction: *do not grade on a curve, do not soften a score because the rest of the call was good, and do not inflate because the agent sounded pleasant.*
- Every category score must be justified by a `[mm:ss]` moment in `score_breakdown_notes`. **A category with no cited moment must be scored at the `adequate` anchor**, not guessed high or low.

Then add a code-level (not LLM) verification step in `src/lib/ai/call-quality.ts`:

```ts
export function verifyAudit(audit: NormalizedAudit, listen: ListenPassResult): {
  audit: NormalizedAudit;
  warnings: string[];
}
```

It must:

- Parse every `[mm:ss]` marker in `what_went_wrong`, `what_went_well`, and `score_breakdown_notes`. Any timestamp that falls outside the call duration, or inside an `inaudible_spans` range, gets flagged — append a warning and strip the marker rather than leaving a fabricated citation in the report.
- Recompute the total from `score_breakdown` and overwrite `overall_score` (the existing ±3 tolerance in `normalizeAuditResponse` is too loose — make it exact).
- Assert each category is within `0..max` for the *scorecard actually used*, not the hardcoded `RUBRIC_MAX`.
- Assert every `mandatoryPhrases` entry has a `compliance_check` result.
- Store warnings on the audit report so they render in a small "QA integrity" strip on the call detail page. If the auditor cited moments that don't exist, we want to see that, not hide it.

---

## Change 5 — Make the feedback sound like a person

Rewrite only the `team_leader_feedback` instruction in the score pass:

> Write as a team leader speaking to this agent at their desk, right after the call. 8–14 sentences. Use their name if you have it. Open with the specific thing they did well and quote it. Then the main problem, with the moment it happened — "at 2:14 you went quiet for eight seconds after she asked about the excess, and that's where you lost her." Then exactly what to say next time, in words the agent would actually use. Close with the one thing to fix on the next call.
>
> Do not use the words: leverage, utilize, robust, synergy, moving forward, going forward, at the end of the day, circle back. Do not open with "Overall" or "Great job". Do not write a bulleted list. Do not praise something you cannot point to a timestamp for. If the call was bad, say so plainly and kindly — a TL who softens everything is useless to the agent.

Add a `manager_summary` field: two sentences, blunt, for the QA manager rather than the agent. Different audience, different register.

---

## Constraints

- Keep the Ubuntu Yaru look — no new UI libraries, use the existing `components/ui` primitives.
- `ALLOW_DEMO_FALLBACK` stays honoured; both new passes must surface real errors when keys are missing rather than fabricating an audit.
- Keep the Whisper/OpenAI transcript path working as a fallback (`LISTEN_MODE=transcript`) — the score pass should accept a transcript-only input where acoustic evidence is absent, and in that case explicitly note in the report that delivery could not be assessed rather than scoring it blind.
- Update `README.md` and `.env.example` to describe the two-pass flow.
- TypeScript strict, no `any` in the new files.

Start by showing me the plan and the file-by-file diff summary before you write code.

---

## After Cursor is done

Paste your real QA form into Settings → Scorecards, then run the same recording through it three times. If the three overall scores land within about 2 points of each other and every category note has a real timestamp, the drift is fixed. If they don't, the anchors in your scorecard are too vague — that's where to tighten, not the prompt.
