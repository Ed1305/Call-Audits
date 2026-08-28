/**
 * Text LLM client used by the score pass (never sees audio).
 * Temperature is always 0.0.
 */

import {
  callGemini,
  extractGeminiText,
} from "./gemini";

function allowDemoFallback(): boolean {
  return (
    process.env.ALLOW_DEMO_FALLBACK === "true" ||
    process.env.ALLOW_DEMO_FALLBACK === "1"
  );
}

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

export async function callLlmJson(
  systemPrompt: string,
  userPrompt: string,
  model?: string
): Promise<string> {
  const provider = (process.env.LLM_PROVIDER || "openai").toLowerCase();

  if (provider === "gemini") {
    return callGeminiText(systemPrompt, userPrompt, model);
  }
  if (provider === "ollama") {
    return callOllama(systemPrompt, userPrompt, model);
  }
  return callOpenAICompatible(systemPrompt, userPrompt, model);
}

async function callGeminiText(
  systemPrompt: string,
  userPrompt: string,
  model?: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === "your-gemini-api-key") {
    if (allowDemoFallback()) return generateMockAudit(userPrompt);
    throw new Error(
      "GEMINI_API_KEY is missing. Set it in .env, or set ALLOW_DEMO_FALLBACK=true for demo mode."
    );
  }

  const response = await callGemini(
    apiKey,
    {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.0,
        topP: 0.1,
        responseMimeType: "application/json",
      },
    },
    { models: geminiModelChain(model) }
  );

  return extractGeminiText(response);
}

async function callOpenAICompatible(
  systemPrompt: string,
  userPrompt: string,
  model?: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const resolvedModel = model || process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (!apiKey || apiKey === "sk-your-key-here") {
    if (allowDemoFallback()) {
      return generateMockAudit(
        userPrompt,
        "Demo mode — configure OPENAI_API_KEY or switch to LLM_PROVIDER=gemini / ollama"
      );
    }
    throw new Error(
      "OPENAI_API_KEY is missing. Set billing + key, use LLM_PROVIDER=gemini with GEMINI_API_KEY, or LLM_PROVIDER=ollama. Set ALLOW_DEMO_FALLBACK=true only for demos."
    );
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: resolvedModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    if (allowDemoFallback() && [401, 403, 429].includes(response.status)) {
      console.error(`[llm] OpenAI ${response.status} — demo fallback`);
      return generateMockAudit(userPrompt, `OpenAI API error (${response.status})`);
    }
    throw new Error(`LLM API error: ${response.status} - ${err}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned an empty response");
  }
  return content;
}

async function callOllama(
  systemPrompt: string,
  userPrompt: string,
  model?: string
): Promise<string> {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const resolvedModel = model || process.env.OLLAMA_MODEL || "llama3.2";

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: resolvedModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
        format: "json",
        options: { temperature: 0 },
      }),
    });

    if (!response.ok) {
      if (allowDemoFallback()) return generateMockAudit(userPrompt);
      throw new Error(`Ollama error: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as { message?: { content?: string } };
    const content = data.message?.content;
    if (!content) {
      throw new Error("Ollama returned an empty response");
    }
    return content;
  } catch (err) {
    if (allowDemoFallback()) return generateMockAudit(userPrompt);
    throw err instanceof Error
      ? err
      : new Error("Ollama is not reachable. Start Ollama or switch provider.");
  }
}

function generateMockAudit(userPrompt: string, reason?: string): string {
  const notice =
    reason ||
    "Demo fallback — enable a real LLM for human-quality listening QA.";

  return JSON.stringify({
    summary:
      "Demo audit only. This was not a real listen of the call. Configure Gemini (recommended), OpenAI, or Ollama.",
    agent_name: "Unknown",
    client_name: "Unknown",
    agent_selected_disposition: "CC",
    recommended_disposition: "CC",
    disposition_match: true,
    disposition_rationale: notice,
    what_went_wrong: [`Demo mode: ${notice}`],
    what_went_well: [
      "Pipeline reached the audit step — wire a real LLM to coach from the actual call.",
    ],
    what_should_have_been_done: [
      "Set LLM_PROVIDER=gemini and GEMINI_API_KEY for real audio listening, or fix OpenAI/Ollama.",
    ],
    focus_areas: ["Restore a working LLM before using scores for coaching."],
    team_leader_feedback:
      "I can't coach this call properly — the AI listener was not configured. Once Gemini or another model is connected, re-run the audit and I'll give you real feedback from the recording.",
    immediate_coaching_notes: notice,
    priority_improvement_focus: notice,
    manager_summary: notice,
    compliance_check: [],
    score_breakdown_notes: {},
    score_breakdown: {
      opening_greeting: 0,
      verification_compliance: 0,
      understanding_probing: 0,
      communication_clarity: 0,
      empathy_professionalism: 0,
      resolution_accuracy: 0,
      call_control_ownership: 0,
      disposition_accuracy: 0,
      closing_next_steps: 0,
    },
    overall_score: 0,
    grade: "F",
    pass_fail: "fail",
  });
}

export { allowDemoFallback };
