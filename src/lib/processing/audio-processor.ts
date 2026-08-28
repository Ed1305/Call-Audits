import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import type { ProcessingResult } from "@/lib/ai/prompts";

const PROCESSOR_TIMEOUT_MS = 600_000; // 10 min — real whisper + diarization on CPU

function allowDemoFallback(): boolean {
  return (
    process.env.ALLOW_DEMO_FALLBACK === "true" ||
    process.env.ALLOW_DEMO_FALLBACK === "1"
  );
}

export async function runAudioProcessor(
  audioPath: string
): Promise<ProcessingResult> {
  const processorEnabled =
    process.env.PROCESSOR_ENABLED === "true" ||
    process.env.PROCESSOR_ENABLED === "1";

  if (!processorEnabled) {
    if (allowDemoFallback()) {
      console.log(
        "[processor] Demo transcript (PROCESSOR_ENABLED=false, ALLOW_DEMO_FALLBACK=true)"
      );
      return generateMockProcessing();
    }
    throw new Error(
      "Real transcription is required. Set PROCESSOR_ENABLED=true after installing processor deps, or use LLM_PROVIDER=gemini with LISTEN_MODE=audio (hears the call directly). Set ALLOW_DEMO_FALLBACK=true only for demos."
    );
  }

  const pythonPath = process.env.PYTHON_PATH || "python";
  const scriptPath =
    process.env.PROCESSOR_SCRIPT ||
    path.join(process.cwd(), "processor", "process_call.py");

  if (!fs.existsSync(scriptPath)) {
    if (allowDemoFallback()) return generateMockProcessing();
    throw new Error(`Processor script not found: ${scriptPath}`);
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finishOk = (result: ProcessingResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const finishErr = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (allowDemoFallback()) {
        console.error("[processor]", err.message, "— demo fallback");
        resolve(generateMockProcessing());
        return;
      }
      reject(err);
    };

    const proc = spawn(pythonPath, [scriptPath, audioPath], {
      env: {
        ...process.env,
        WHISPER_MODEL: process.env.WHISPER_MODEL || "base",
        HF_TOKEN: process.env.HF_TOKEN || "",
        HUGGING_FACE_HUB_TOKEN: process.env.HF_TOKEN || "",
      },
    });

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      finishErr(
        new Error(
          `Transcription timed out after ${PROCESSOR_TIMEOUT_MS / 60000} minutes`
        )
      );
    }, PROCESSOR_TIMEOUT_MS);

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      const msg = data.toString();
      stderr += msg;
      console.error("[processor]", msg.trim());
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        finishErr(
          new Error(
            `Transcription failed (exit ${code}). ${stderr.trim() || "No stderr"}`
          )
        );
        return;
      }

      try {
        const result = JSON.parse(stdout.trim()) as ProcessingResult;
        if (!result.segments?.length) {
          finishErr(new Error("Transcription returned no segments"));
          return;
        }
        finishOk(result);
      } catch (err) {
        finishErr(
          new Error(
            `Failed to parse processor JSON: ${err instanceof Error ? err.message : err}`
          )
        );
      }
    });

    proc.on("error", (err) => {
      finishErr(
        new Error(
          `Could not start Python processor (${err.message}). Install deps: pip install -r processor/requirements.txt`
        )
      );
    });
  });
}

function generateMockProcessing(): ProcessingResult {
  return {
    duration: 180,
    segments: [
      {
        speaker: "Agent",
        start: 0,
        end: 8,
        text: `Thank you for calling, my name is Sarah. How can I help you today?`,
      },
      {
        speaker: "Client",
        start: 8.5,
        end: 22,
        text: `Hi, I'm calling about my account. I've been charged twice this month and I need this resolved.`,
      },
      {
        speaker: "Agent",
        start: 22.5,
        end: 35,
        text: `I'm sorry to hear about that inconvenience. Let me pull up your account. Can I have your account number or the phone number on the account please?`,
      },
      {
        speaker: "Client",
        start: 35.5,
        end: 42,
        text: `Sure, it's 555-0142. My name is John Mitchell.`,
      },
      {
        speaker: "Agent",
        start: 42.5,
        end: 58,
        text: `Thank you Mr. Mitchell. I can see the duplicate charge of $49.99 from the 15th. I'll process a refund right now — it should appear within 3-5 business days.`,
      },
      {
        speaker: "Client",
        start: 58.5,
        end: 65,
        text: `Okay, that works. Will I get a confirmation email?`,
      },
      {
        speaker: "Agent",
        start: 65.5,
        end: 78,
        text: `Absolutely, you'll receive a confirmation email within the hour. Is there anything else I can help you with today?`,
      },
      {
        speaker: "Client",
        start: 78.5,
        end: 82,
        text: `No, that's all. Thank you for your help.`,
      },
      {
        speaker: "Agent",
        start: 82.5,
        end: 90,
        text: `You're welcome Mr. Mitchell. Thank you for calling and have a great day!`,
      },
    ],
    participants: {
      agent: { name: "Sarah", confidence: 0.85 },
      client: { name: "John Mitchell", confidence: 0.9 },
    },
  };
}
