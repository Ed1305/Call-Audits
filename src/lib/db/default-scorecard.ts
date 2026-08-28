import { v4 as uuidv4 } from "uuid";
import {
  DISPOSITION_CODES,
  DISPOSITION_LABELS,
  type DispositionCode,
} from "@/lib/utils";
import type { CampaignScorecard, RubricCriterion } from "./schema";
import { RUBRIC_MAX } from "@/lib/ai/prompts";

const CRITERION_COPY: Record<
  string,
  { label: string; description: string; anchors: RubricCriterion["anchors"] }
> = {
  opening_greeting: {
    label: "Opening & greeting",
    description:
      "Name, company, reason for the call, and recording disclosure in the first seconds.",
    anchors: {
      excellent:
        "Agent gives their name and company, states why they are calling, and mentions the call may be recorded — all before pitching.",
      adequate:
        "Agent greets and names the company but skips one of: personal name, purpose, or recording line.",
      poor: "Agent launches into a pitch, uses a generic greeting, or never identifies who they are.",
    },
  },
  verification_compliance: {
    label: "Verification & compliance",
    description:
      "Mandatory disclosures, identity confirmation, and no prohibited promises.",
    anchors: {
      excellent:
        "Every required disclosure is said (or clearly paraphrased) and the client is confirmed before product detail.",
      adequate:
        "Most compliance lines are covered but one is paraphrased loosely or delayed.",
      poor: "Required lines are missing, the wrong person is pitched, or a prohibited claim is made.",
    },
  },
  understanding_probing: {
    label: "Understanding & probing",
    description:
      "Questions that uncover need, objections, and facts before the close.",
    anchors: {
      excellent:
        "Agent asks targeted questions, listens to the answers, and uses them in the pitch.",
      adequate:
        "Some probing happens but the agent talks past an answer or skips a key qualifier.",
      poor: "Agent reads a script and does not ask, or talks over the client's answers.",
    },
  },
  communication_clarity: {
    label: "Communication clarity",
    description:
      "Pace, dead air, talk-over, and whether the client can actually follow the agent.",
    anchors: {
      excellent:
        "Measured pace, short pauses that feel natural, no talk-over, language the client uses back.",
      adequate:
        "Mostly clear with one rushed stretch or a brief overlap that recovers quickly.",
      poor: "Rushed or slow to the point of confusion, long dead air, or repeated talk-over.",
    },
  },
  empathy_professionalism: {
    label: "Empathy & professionalism",
    description: "Tone, respect, and how the agent handles friction.",
    anchors: {
      excellent:
        "Warm at the open, stays steady on objections, never impatient or dismissive.",
      adequate:
        "Polite throughout but flat after a pushback, or slightly rushed at the close.",
      poor: "Impatient, sarcastic, or talks down to the client.",
    },
  },
  resolution_accuracy: {
    label: "Resolution accuracy",
    description:
      "Product facts, next steps, and whether the outcome matches what was actually agreed.",
    anchors: {
      excellent:
        "Facts match the campaign, the outcome is explicit, and the client knows what happens next.",
      adequate:
        "Core facts are right but a detail is vague or a next step is assumed rather than confirmed.",
      poor: "Wrong product facts, invented promises, or an outcome that was not agreed.",
    },
  },
  call_control_ownership: {
    label: "Call control & ownership",
    description:
      "Who drives the call, how silence and interruptions are handled, who owns the next step.",
    anchors: {
      excellent:
        "Agent steers without steamrolling, recovers from silence, and owns the close.",
      adequate:
        "Agent mostly leads but loses the thread after an objection or a long pause.",
      poor: "Agent is talked over, leaves long dead air, or lets the call drift with no owner.",
    },
  },
  disposition_accuracy: {
    label: "Disposition accuracy",
    description:
      "Whether the code matches how the call actually ended.",
    anchors: {
      excellent:
        "Selected code matches the observed outcome and the decision tree.",
      adequate:
        "Close enough that a TL would not change coaching, but a tighter code exists.",
      poor: "Wrong code, no code, or a code that contradicts what the client said.",
    },
  },
  closing_next_steps: {
    label: "Closing & next steps",
    description: "A clear end: time, owner, and what the client should expect.",
    anchors: {
      excellent:
        "Specific time/window, who will call, and a short recap before goodbye.",
      adequate:
        "A callback or close is agreed but the time or owner is fuzzy.",
      poor: "Call ends with no next step, or the agent hangs into silence.",
    },
  },
};

const DISPOSITION_WHEN: Record<DispositionCode, string> = {
  CALLBK: "Callback agreed with a time or window after some pitch",
  CC: "Line drops or the customer hangs up mid-call before a clear outcome",
  CNP: "Callback agreed but almost no product presentation",
  DNC: "Customer asks not to be called again",
  DNQ: "Did not qualify (generic)",
  DNQCV: "Did not qualify — car value",
  DNQNV: "Did not qualify — no vehicle",
  DNQS: "Did not qualify — salary band",
  DNQU: "Did not qualify — unemployed",
  LB: "Language barrier prevents the pitch",
  N: "No human answer / ringing out",
  NI: "Customer clearly not interested / already covered and refuses",
  NOA: "Customer not available now but no firm callback time",
  SALE: "Sale / application completed",
  TS: "Technical / process troubleshooting handoff",
  V: "Voicemail / automated greeting only",
  WN: "Wrong person / wrong number",
};

export function buildDefaultScorecard(
  now = new Date().toISOString()
): CampaignScorecard {
  const criteria: RubricCriterion[] = Object.entries(RUBRIC_MAX).map(
    ([key, max]) => {
      const copy = CRITERION_COPY[key];
      return {
        key,
        label: copy?.label || key.replace(/_/g, " "),
        max,
        description: copy?.description || key.replace(/_/g, " "),
        anchors: copy?.anchors || {
          excellent: "Full marks for this category.",
          adequate: "Mid score for this category.",
          poor: "Low score for this category.",
        },
      };
    }
  );

  return {
    id: uuidv4(),
    name: "Default outbound QA",
    scriptText: "",
    mandatoryPhrases: [],
    prohibitedClaims: [],
    criteria,
    dispositionCodes: DISPOSITION_CODES.map((code) => ({
      code,
      label: DISPOSITION_LABELS[code],
      whenToUse: DISPOSITION_WHEN[code],
    })),
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  };
}
