export interface CallAnalysis {
  agentName: string;
  employeeCode: string;
  employeeCodeValid: boolean;
  employeeCodeFeedback: string;
  disposition: 'CALLBK' | 'CC' | 'CNP' | 'NI' | 'DNC' | 'DNQ' | 'SALE' | 'UNKNOWN';
  dispositionFeedback: string;
  whatWentWrong: string;
  whatCouldHaveBeenDone: string;
  analysis: {
    pitch: string;
    attitude: string;
    needCreating: string;
    discoveryQuestions: string;
    qualifyingQuestions: string;
  };
  toneAnalysis: {
    overallTone: string;
    energyLevel: string;
    empathyScore: number;
    pacing: string;
    coachingFeedback: string;
  };
  overallScore: number;
  summary: string;
  transcript: { speaker: string; text: string }[];
}

export interface SavedAnalysis {
  id: string;
  timestamp: number;
  fileName: string;
  audioBase64: string;
  mimeType: string;
  analysis: CallAnalysis;
}
