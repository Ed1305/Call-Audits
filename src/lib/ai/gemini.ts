/**
 * Gemini generateContent with retry + model fallback.
 * Used for real audio "listening" audits (multimodal).
 */

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models";
const UPLOAD_ROOT = "https://generativelanguage.googleapis.com/upload/v1beta/files";
/** Prefer current GA models — 2.5-* is blocked for many new API keys */
const MODEL_CHAIN = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
];
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
/** Model missing / retired for this key — skip to next in the chain */
const MODEL_UNAVAILABLE = new Set([404]);
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1000;
/** Prefer Files API above this to stay under inline payload limits */
const INLINE_MAX_BYTES = 15 * 1024 * 1024;

export interface GeminiOptions {
  models?: string[];
  maxAttempts?: number;
  signal?: AbortSignal;
}

export async function callGemini(
  apiKey: string,
  body: unknown,
  opts: GeminiOptions = {}
): Promise<GeminiGenerateResponse> {
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

        if (res.ok) {
          return (await res.json()) as GeminiGenerateResponse;
        }

        const text = await res.text();
        lastError = new Error(`Gemini ${res.status} (${model}): ${text}`);

        // Retired / not available for this account — try the next model immediately
        if (MODEL_UNAVAILABLE.has(res.status)) {
          console.warn(`[gemini] ${model} unavailable (${res.status}), trying next model`);
          break;
        }

        if (!RETRYABLE.has(res.status)) {
          throw lastError;
        }

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
          const code = Number(err.message.match(/Gemini (\d{3})/)?.[1]);
          if (MODEL_UNAVAILABLE.has(code)) {
            lastError = err;
            break;
          }
          if (!isRetryableMessage(err.message)) throw err;
        }
        lastError = err as Error;
        if (attempt < maxAttempts - 1) {
          await sleep(BASE_DELAY_MS * 2 ** attempt + Math.random() * 300);
        }
      }
    }
    console.warn(`[gemini] ${model} exhausted, trying next model`);
  }

  throw new Error(
    `All Gemini models failed after ${maxAttempts} attempts each. Last error: ${lastError?.message}`
  );
}

export interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

export function extractGeminiText(response: GeminiGenerateResponse): string {
  const text = response.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || "")
    .join("")
    .trim();
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }
  return text;
}

export async function buildAudioPart(
  apiKey: string,
  audioPath: string,
  mimeType: string,
  buffer: Buffer
): Promise<{ inline_data: { mime_type: string; data: string } } | { file_data: { mime_type: string; file_uri: string } }> {
  if (buffer.length <= INLINE_MAX_BYTES) {
    return {
      inline_data: {
        mime_type: mimeType,
        data: buffer.toString("base64"),
      },
    };
  }

  const fileUri = await uploadGeminiFile(apiKey, buffer, mimeType, audioPath);
  return {
    file_data: {
      mime_type: mimeType,
      file_uri: fileUri,
    },
  };
}

async function uploadGeminiFile(
  apiKey: string,
  buffer: Buffer,
  mimeType: string,
  displayName: string
): Promise<string> {
  const startRes = await fetch(
    `${UPLOAD_ROOT}?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(buffer.length),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file: { display_name: displayName.split(/[/\\]/).pop() || "call-audio" },
      }),
    }
  );

  if (!startRes.ok) {
    throw new Error(
      `Gemini file upload start failed: ${startRes.status} ${await startRes.text()}`
    );
  }

  const uploadUrl = startRes.headers.get("x-goog-upload-url");
  if (!uploadUrl) {
    throw new Error("Gemini file upload did not return an upload URL");
  }

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(buffer.length),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: new Uint8Array(buffer),
  });

  if (!uploadRes.ok) {
    throw new Error(
      `Gemini file upload failed: ${uploadRes.status} ${await uploadRes.text()}`
    );
  }

  const meta = (await uploadRes.json()) as {
    file?: { uri?: string; name?: string; state?: string };
  };
  const uri = meta.file?.uri;
  const name = meta.file?.name;
  if (!uri || !name) {
    throw new Error("Gemini file upload response missing file uri");
  }

  await waitForFileActive(apiKey, name);
  return uri;
}

async function waitForFileActive(apiKey: string, name: string): Promise<void> {
  const resource = name.startsWith("files/") ? name : `files/${name}`;
  for (let i = 0; i < 30; i++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${resource}?key=${apiKey}`
    );
    if (!res.ok) {
      throw new Error(`Gemini file status failed: ${res.status}`);
    }
    const meta = (await res.json()) as { state?: string };
    if (meta.state === "ACTIVE") return;
    if (meta.state === "FAILED") {
      throw new Error("Gemini file processing failed");
    }
    await sleep(1000);
  }
  throw new Error("Timed out waiting for Gemini file to become ACTIVE");
}

function isRetryableMessage(msg: string): boolean {
  const m = msg.match(/Gemini (\d{3})/);
  return m ? RETRYABLE.has(Number(m[1])) : true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
