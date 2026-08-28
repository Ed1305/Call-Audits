/**
 * Drop-in wrapper for Gemini calls (retry + model fallback).
 * App code uses src/lib/ai/gemini.ts — keep this file for standalone scripts.
 */

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models";

const MODEL_CHAIN = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
];
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1000;

export interface GeminiOptions {
  models?: string[];
  maxAttempts?: number;
  signal?: AbortSignal;
}

export async function callGemini(
  apiKey: string,
  body: unknown,
  opts: GeminiOptions = {}
): Promise<any> {
  const models = opts.models ?? MODEL_CHAIN;
  const maxAttempts = opts.maxAttempts ?? MAX_ATTEMPTS;
  let lastError: Error | null = null;

  for (const model of models) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const res = await fetch(
          `${API_ROOT}/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: opts.signal,
          }
        );

        if (res.ok) return await res.json();

        const text = await res.text();
        if (!RETRYABLE.has(res.status)) {
          throw new Error(`Gemini ${res.status} (${model}): ${text}`);
        }

        lastError = new Error(`Gemini ${res.status} (${model}): ${text}`);
        const retryAfter = Number(res.headers.get("retry-after"));
        const delay =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : BASE_DELAY_MS * 2 ** attempt + Math.random() * 300;

        if (attempt < maxAttempts - 1) {
          console.warn(
            `[gemini] ${res.status} on ${model}, retry ${attempt + 1}/${maxAttempts} in ${Math.round(delay)}ms`
          );
          await sleep(delay);
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("Gemini ")) {
          if (!isRetryableMessage(err.message)) throw err;
        }
        lastError = err as Error;
        if (attempt < maxAttempts - 1) {
          await sleep(BASE_DELAY_MS * 2 ** attempt + Math.random() * 300);
        }
      }
    }
    console.warn(`[gemini] ${model} exhausted, falling back to next model`);
  }

  throw new Error(
    `All Gemini models failed after ${maxAttempts} attempts each. Last error: ${lastError?.message}`
  );
}

function isRetryableMessage(msg: string): boolean {
  const m = msg.match(/Gemini (\d{3})/);
  return m ? RETRYABLE.has(Number(m[1])) : true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
