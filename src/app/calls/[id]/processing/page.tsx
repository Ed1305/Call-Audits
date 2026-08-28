"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle, Circle, Loader2, XCircle } from "lucide-react";
import { GnomeWindow } from "@/components/ui/GnomeWindow";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button } from "@/components/ui/Button";
import { GnomeSpinner } from "@/components/ui/Spinner";
import { PROCESSING_STEPS } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { rememberCall } from "@/lib/history/local-history";

export default function ProcessingPage() {
  const params = useParams();
  const router = useRouter();
  const callId = params.id as string;
  const [status, setStatus] = useState("uploaded");
  const [filename, setFilename] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/calls/${callId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setStatus(data.uploadStatus);
        setFilename(data.filename);
        setError(data.processingError);
        setPollCount((c) => c + 1);

        if (data.uploadStatus === "completed") {
          rememberCall(data);
          setTimeout(() => router.replace(`/calls/${callId}`), 2000);
        }
      } catch {
        /* retry on next poll */
      }
    };

    poll();
    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [callId, router]);

  // Short path = Gemini hears the call; classic = Whisper then text QA.
  const classic = ["transcribing", "diarizing", "analyzing"].includes(status);
  const steps = classic
    ? PROCESSING_STEPS.filter((s) => s.key !== "listening")
    : PROCESSING_STEPS.filter((s) =>
        ["uploaded", "listening", "analyzing", "completed"].includes(s.key)
      );

  const stepIndex = steps.findIndex((s) => s.key === status);
  const progress =
    status === "failed"
      ? 0
      : status === "completed"
        ? 100
        : ((Math.max(stepIndex, 0) + 1) / steps.length) * 100;

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
      <div className="text-center">
        <h1 className="font-ubuntu text-2xl font-bold">Processing Call</h1>
        {filename && (
          <p className="font-ubuntu text-sm text-gray-500 mt-1">{filename}</p>
        )}
      </div>

      <GnomeWindow title="Audit Pipeline">
        <div className="space-y-6">
          {status !== "failed" && status !== "completed" && (
            <div className="flex justify-center py-4">
              <GnomeSpinner className="w-10 h-10" />
            </div>
          )}

          {status === "completed" && (
            <div className="flex justify-center py-4">
              <CheckCircle className="w-12 h-12 text-ubuntu-maximize" />
            </div>
          )}

          {status === "failed" && (
            <div className="flex justify-center py-4">
              <XCircle className="w-12 h-12 text-ubuntu-close" />
            </div>
          )}

          <ProgressBar value={progress} label="Overall Progress" />

          <div className="space-y-3">
            {steps.map((step, i) => {
              const isDone =
                status === "completed" || (stepIndex >= 0 && i < stepIndex);
              const isCurrent = step.key === status;
              // On failure, mark the active pipeline step (usually listening)
              const isFailed =
                status === "failed" &&
                (step.key === "listening" ||
                  (classic && i === Math.max(stepIndex, 1)));

              return (
                <div
                  key={step.key}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-gnome-sm transition-colors",
                    isCurrent && "bg-ubuntu-orange/10"
                  )}
                >
                  {isDone ? (
                    <CheckCircle className="w-5 h-5 text-ubuntu-maximize shrink-0" />
                  ) : isCurrent ? (
                    <Loader2 className="w-5 h-5 text-ubuntu-orange animate-gnome-spin shrink-0" />
                  ) : isFailed ? (
                    <XCircle className="w-5 h-5 text-ubuntu-close shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-400 shrink-0" />
                  )}
                  <span
                    className={cn(
                      "font-ubuntu text-sm",
                      isDone && "text-ubuntu-maximize",
                      isCurrent && "font-medium text-ubuntu-orange",
                      isFailed && "text-ubuntu-close",
                      !isDone && !isCurrent && !isFailed && "text-gray-500"
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {error && (
            <div className="p-3 rounded-gnome-sm bg-ubuntu-close/10 text-ubuntu-close text-sm font-ubuntu">
              {error}
            </div>
          )}

          {status === "completed" && (
            <div className="space-y-3">
              <p className="text-center font-ubuntu text-sm text-ubuntu-maximize">
                Audit complete! Redirecting to report...
              </p>
              <div className="flex justify-center">
                <Button onClick={() => router.replace(`/calls/${callId}`)}>
                  View Audit Report Now
                </Button>
              </div>
            </div>
          )}

          {status !== "completed" &&
            status !== "failed" &&
            pollCount > 12 &&
            (status === "listening" ||
              status === "analyzing" ||
              status === "transcribing") && (
              <p className="font-ubuntu text-xs text-gray-500 text-center">
                {status === "listening"
                  ? "Still listening — taking notes from the recording. Longer calls take a bit."
                  : status === "analyzing"
                    ? "Scoring against the campaign QA form from those notes."
                    : "Still transcribing. Check Python deps and PROCESSOR_ENABLED, or switch to LLM_PROVIDER=gemini + LISTEN_MODE=audio for a faster listen path."}
              </p>
            )}

          {status === "failed" && (
            <div className="flex justify-center gap-3">
              <Button variant="secondary" onClick={() => router.push("/upload")}>
                Try Again
              </Button>
              <Button onClick={() => router.push("/calls")}>
                View Calls
              </Button>
            </div>
          )}
        </div>
      </GnomeWindow>
    </div>
  );
}
