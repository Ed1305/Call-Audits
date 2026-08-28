"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileAudio, X } from "lucide-react";
import { GnomeWindow } from "@/components/ui/GnomeWindow";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { GnomeSpinner } from "@/components/ui/Spinner";
import { showToast } from "@/components/ui/Toast";
import { DISPOSITION_CODES, formatDisposition } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { CampaignScorecard } from "@/lib/db/schema";

const ACCEPTED = [".mp3", ".wav", ".m4a", ".ogg"];

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [disposition, setDisposition] = useState("");
  const [agentName, setAgentName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [scorecards, setScorecards] = useState<CampaignScorecard[]>([]);
  const [scorecardId, setScorecardId] = useState("");

  useEffect(() => {
    fetch("/api/scorecards")
      .then((r) => r.json())
      .then((data: CampaignScorecard[]) => {
        if (!Array.isArray(data)) return;
        setScorecards(data);
        const def = data.find((c) => c.isDefault) || data[0];
        if (def) setScorecardId(def.id);
      })
      .catch(() => {
        /* keep hardcoded dispositions */
      });
  }, []);

  const selectedScorecard =
    scorecards.find((c) => c.id === scorecardId) || null;
  const dispositionOptions =
    selectedScorecard?.dispositionCodes?.length
      ? selectedScorecard.dispositionCodes.map((d) => ({
          value: d.code,
          label: `${d.code} — ${d.label}`,
        }))
      : DISPOSITION_CODES.map((code) => ({
          value: code,
          label: formatDisposition(code),
        }));

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && isValidFile(dropped)) {
      setFile(dropped);
    } else {
      showToast("Please upload mp3, wav, m4a, or ogg files only", "error");
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && isValidFile(selected)) {
      setFile(selected);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      showToast("Please select an audio file", "error");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    if (disposition) formData.append("agentDisposition", disposition);
    if (agentName) formData.append("agentName", agentName);
    if (scorecardId) formData.append("scorecardId", scorecardId);

    try {
      const res = await fetch("/api/calls/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }

      const data = await res.json();
      showToast("Call uploaded — processing started", "success");
      router.replace(`/calls/${data.id}/processing`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Upload failed",
        "error"
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in relative">
      {uploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-ubuntu-card-dark rounded-gnome p-8 flex flex-col items-center gap-4 shadow-gnome-lg">
            <GnomeSpinner className="w-12 h-12" />
            <p className="font-ubuntu text-ubuntu-text-light">
              Uploading call recording...
            </p>
          </div>
        </div>
      )}
      <div>
        <h1 className="font-ubuntu text-2xl font-bold">Upload Call</h1>
        <p className="font-ubuntu text-sm text-gray-500 mt-1">
          Upload a call recording for AI-powered QA audit
        </p>
      </div>

      <GnomeWindow title="Select Audio File">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-gnome p-12 text-center transition-all cursor-pointer",
            dragging
              ? "border-ubuntu-orange bg-ubuntu-orange/5"
              : "border-gray-300 dark:border-gray-600 hover:border-ubuntu-orange/50"
          )}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept={ACCEPTED.join(",")}
            onChange={handleFileSelect}
            className="hidden"
          />

          {file ? (
            <div className="flex items-center justify-center gap-4">
              <FileAudio className="w-10 h-10 text-ubuntu-orange" />
              <div className="text-left">
                <p className="font-ubuntu font-medium">{file.name}</p>
                <p className="font-ubuntu-mono text-xs text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
                className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="font-ubuntu text-sm font-medium">
                Drag and drop your call recording here
              </p>
              <p className="font-ubuntu text-xs text-gray-500 mt-2">
                or click to browse — mp3, wav, m4a, ogg supported
              </p>
            </>
          )}
        </div>
      </GnomeWindow>

      <GnomeWindow title="Call Details">
        <div className="space-y-4">
          {scorecards.length > 0 && (
            <Select
              label="Scorecard"
              value={scorecardId}
              onChange={(e) => {
                setScorecardId(e.target.value);
                setDisposition("");
              }}
              options={scorecards.map((c) => ({
                value: c.id,
                label: c.isDefault ? `${c.name} (default)` : c.name,
              }))}
            />
          )}
          <Select
            label="Agent Disposition"
            value={disposition}
            onChange={(e) => setDisposition(e.target.value)}
            options={[
              { value: "", label: "Select disposition (optional)" },
              ...dispositionOptions,
            ]}
          />
          <Input
            label="Agent Name (optional)"
            placeholder="e.g. Sarah Johnson"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
          />
          <p className="font-ubuntu text-xs text-gray-500">
            If not provided, the AI will attempt to extract names from the
            conversation during analysis.
          </p>
        </div>
      </GnomeWindow>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button
          onClick={handleUpload}
          disabled={!file || uploading}
        >
          {uploading ? "Uploading..." : "Upload & Start Audit"}
        </Button>
      </div>
    </div>
  );
}

function isValidFile(file: File): boolean {
  const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
  if (ACCEPTED.includes(ext)) return true;
  // Fallback: accept common audio MIME types
  return file.type.startsWith("audio/");
}
