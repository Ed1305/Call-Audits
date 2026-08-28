export type UploadStatus =
  | "uploaded"
  | "listening"
  | "transcribing"
  | "diarizing"
  | "analyzing"
  | "completed"
  | "failed";

export interface RubricCriterion {
  key: string;
  label: string;
  max: number;
  description: string;
  anchors: {
    excellent: string;
    adequate: string;
    poor: string;
  };
  autoFailIf?: string;
}

export interface CampaignScorecard {
  id: string;
  name: string;
  scriptText: string;
  mandatoryPhrases: string[];
  prohibitedClaims: string[];
  criteria: RubricCriterion[];
  dispositionCodes: { code: string; label: string; whenToUse: string }[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CallRecord {
  id: string;
  filename: string;
  originalPath: string;
  audioDuration: number | null;
  uploadStatus: UploadStatus;
  agentDisposition: string | null;
  agentNameHint?: string | null;
  scorecardId: string | null;
  processingError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CallParticipant {
  id: string;
  callId: string;
  role: "agent" | "client";
  name: string;
  confidence: number;
}

export interface CallTranscriptSegment {
  id: string;
  callId: string;
  speakerLabel: string;
  startTime: number;
  endTime: number;
  text: string;
}

export interface CallDisposition {
  id: string;
  callId: string;
  agentSelectedDisposition: string | null;
  aiRecommendedDisposition: string | null;
  dispositionMatch: boolean | null;
  rationale: string | null;
}

export interface CallAuditReport {
  id: string;
  callId: string;
  summary: string | null;
  whatWentWrong: string | null;
  whatWentWell: string | null;
  whatShouldHaveBeenDone: string | null;
  focusAreas: string | null;
  teamLeaderFeedback: string | null;
  immediateCoachingNotes: string | null;
  priorityImprovementFocus: string | null;
  overallScore: number | null;
  grade: string | null;
  passFail: string | null;
  rubricJson: string | null;
  rawLlmJson: string | null;
  managerSummary: string | null;
  integrityWarnings: string | null;
  complianceCheck: string | null;
  createdAt: string;
}
