import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function GET(): Promise<NextResponse> {
  const pythonPath = process.env.PYTHON_PATH || "python";
  const scriptPath = path.join(process.cwd(), "processor", "test_hf_token.py");

  const hfToken = process.env.HF_TOKEN || "";
  const processorEnabled =
    process.env.PROCESSOR_ENABLED === "true" ||
    process.env.PROCESSOR_ENABLED === "1";

  return new Promise<NextResponse>((resolve) => {
    const proc = spawn(pythonPath, [scriptPath], {
      env: {
        ...process.env,
        HF_TOKEN: hfToken,
        HUGGING_FACE_HUB_TOKEN: hfToken,
      },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    proc.on("close", (code) => {
      try {
        const result = JSON.parse(stdout.trim());
        resolve(
          NextResponse.json({
            ...result,
            processorEnabled,
            hint: !processorEnabled
              ? "Set PROCESSOR_ENABLED=true in .env to use Python transcription"
              : undefined,
          })
        );
      } catch {
        resolve(
          NextResponse.json(
            {
              error: "Failed to run HF token test",
              stderr,
              stdout,
              exitCode: code,
              next_steps: [
                "Install Python deps: pip install -r processor/requirements.txt",
                "Set HF_TOKEN=hf_xxx in .env",
                "Run manually: python processor/test_hf_token.py",
              ],
            },
            { status: 500 }
          )
        );
      }
    });

    proc.on("error", (err) => {
      resolve(
        NextResponse.json(
          {
            error: `Python not found: ${err.message}`,
            next_steps: [
              "Install Python 3.10+",
              "Set PYTHON_PATH=python in .env",
            ],
          },
          { status: 500 }
        )
      );
    });
  });
}

export const runtime = "nodejs";
