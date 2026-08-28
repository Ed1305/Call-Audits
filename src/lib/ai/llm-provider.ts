import type { NormalizedAudit, TranscriptSegment } from "./prompts";
import {
  listenResultFromTranscript,
} from "./listen-pass";
import { runScorePass } from "./score-pass";
import { verifyAudit } from "./call-quality";
import { resolveScorecard } from "@/lib/db";
import type { CampaignScorecard } from "@/lib/db/schema";

export interface LLMProvider {
  analyze(
    transcript: TranscriptSegment[],
    agentDisposition: string | null,
    participants?: { agent?: string; client?: string },
    scorecard?: CampaignScorecard
  ): Promise<NormalizedAudit>;
}

export function useGeminiListenMode(): boolean {
  const provider = (process.env.LLM_PROVIDER || "").toLowerCase();
  if (provider !== "gemini") return false;
  const mode = (process.env.LISTEN_MODE || "audio").toLowerCase();
  return mode !== "transcript";
}

export const llmProvider: LLMProvider = {
  async analyze(transcript, agentDisposition, participants, scorecard) {
    const card = scorecard ?? resolveScorecard(null);
    const duration = transcript.length
      ? Math.max(...transcript.map((s) => s.end), 0)
      : 0;
    const listen = listenResultFromTranscript(transcript, duration, {
      agent: participants?.agent,
      client: participants?.client,
    });
    const audit = await runScorePass(listen, card, agentDisposition);
    return verifyAudit(audit, listen, card).audit;
  },
};

export type { NormalizedAudit };
