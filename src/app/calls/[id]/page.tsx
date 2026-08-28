"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Download,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  FileText,
} from "lucide-react";
import { GnomeWindow } from "@/components/ui/GnomeWindow";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GnomeSpinner } from "@/components/ui/Spinner";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  formatDate,
  formatDuration,
  formatTimestamp,
  formatDisposition,
  cn,
} from "@/lib/utils";
import { generatePDF } from "@/lib/pdf/generate-pdf";
import { GnomeAudioPlayer } from "@/components/ui/GnomeAudioPlayer";
import { showToast } from "@/components/ui/Toast";
import { getRememberedCall, rememberCall } from "@/lib/history/local-history";

interface CallDetail {
  id: string;
  filename: string;
  uploadStatus: string;
  audioDuration: number | null;
  audioUrl?: string | null;
  agentDisposition: string | null;
  createdAt: string;
  participants: { id: string; role: string; name: string; confidence: number }[];
  transcript: {
    id: string;
    speakerLabel: string;
    startTime: number;
    endTime: number;
    text: string;
  }[];
  disposition: {
    agentSelectedDisposition: string | null;
    aiRecommendedDisposition: string | null;
    dispositionMatch: boolean | null;
    rationale: string | null;
  } | null;
  auditReport: {
    summary: string | null;
    whatWentWrong: string[];
    whatWentWell: string[];
    whatShouldHaveBeenDone: string[];
    focusAreas: string[];
    teamLeaderFeedback: string | null;
    immediateCoachingNotes: string;
    priorityImprovementFocus: string | null;
    overallScore: number | null;
    grade: string | null;
    passFail: string | null;
    rubric: Record<string, { score: number; max: number; notes: string }>;
    managerSummary?: string;
    integrityWarnings?: string[];
    complianceCheck?: {
      phrase: string;
      status: string;
      timestamp: string | null;
    }[];
  } | null;
}

export default function CallDetailPage() {
  const params = useParams();
  const callId = params.id as string;
  const [call, setCall] = useState<CallDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch(`/api/calls/${callId}`)
      .then(async (r) => {
        if (r.ok) {
          const data = (await r.json()) as CallDetail;
          if (data.uploadStatus === "completed") rememberCall(data);
          return data;
        }
        return getRememberedCall<CallDetail>(callId);
      })
      .then(setCall)
      .finally(() => setLoading(false));
  }, [callId]);

  const handleDownloadPDF = async () => {
    if (!call?.auditReport) return;
    setDownloading(true);
    try {
      await generatePDF(call);
      showToast("PDF report downloaded", "success");
    } catch {
      showToast("Failed to generate PDF", "error");
    } finally {
      setDownloading(false);
    }
  };

  const updateParticipantName = async (
    participantId: string,
    name: string
  ) => {
    await fetch(`/api/calls/${callId}/participants`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId, name }),
    });
    setCall((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        participants: prev.participants.map((p) =>
          p.id === participantId ? { ...p, name } : p
        ),
      };
    });
    showToast("Participant name updated", "success");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <GnomeSpinner className="w-10 h-10" />
      </div>
    );
  }

  if (!call) {
    return (
      <div className="text-center py-20">
        <p className="font-ubuntu text-gray-500">Call not found</p>
        <Link href="/calls" className="text-ubuntu-orange hover:underline text-sm mt-2 inline-block">
          Back to calls
        </Link>
      </div>
    );
  }

  if (call.uploadStatus !== "completed") {
    return (
      <div className="text-center py-20">
        <GnomeSpinner className="w-10 h-10 mx-auto mb-4" />
        <p className="font-ubuntu text-gray-500">Call is still processing</p>
        <Link
          href={`/calls/${callId}/processing`}
          className="text-ubuntu-orange hover:underline text-sm mt-2 inline-block"
        >
          View processing status
        </Link>
      </div>
    );
  }

  const report = call.auditReport!;
  const rubricEntries = Object.entries(report.rubric || {});

  return (
    <div className="space-y-6 animate-fade-in" id="audit-report">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-ubuntu text-2xl font-bold">{call.filename}</h1>
          <p className="font-ubuntu text-sm text-gray-500 mt-1">
            {formatDate(call.createdAt)}
            {call.audioDuration && ` · ${formatDuration(call.audioDuration)}`}
          </p>
          <p className="font-ubuntu-mono text-xs text-gray-400 mt-0.5">
            Call ID: {call.id}
          </p>
        </div>
        <Button onClick={handleDownloadPDF} disabled={downloading}>
          <Download className="w-4 h-4 mr-2 inline" />
          {downloading ? "Generating..." : "Download PDF Report"}
        </Button>
      </div>

      {call.audioUrl && (
        <GnomeWindow title="Call Recording">
          <GnomeAudioPlayer src={call.audioUrl} />
        </GnomeWindow>
      )}

      {(report.integrityWarnings?.length ?? 0) > 0 && (
        <GnomeWindow title="QA Integrity">
          <p className="font-ubuntu text-xs text-gray-500 mb-2">
            Code-level checks on timestamps, totals, and mandatory phrases.
            These are not hidden — if the auditor cited a moment that does not
            exist, it shows up here.
          </p>
          <ul className="space-y-1.5">
            {report.integrityWarnings!.map((warning, i) => (
              <li
                key={i}
                className="flex gap-2 font-ubuntu text-xs text-ubuntu-minimize"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {warning}
              </li>
            ))}
          </ul>
        </GnomeWindow>
      )}

      {/* Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GnomeWindow title="Overall Score">
          <div className="text-center -mt-2">
            <span
              className={cn(
                "font-ubuntu text-4xl font-bold",
                (report.overallScore ?? 0) >= 70
                  ? "text-ubuntu-maximize"
                  : "text-ubuntu-close"
              )}
            >
              {report.overallScore}
            </span>
            <span className="font-ubuntu text-lg text-gray-500">/100</span>
          </div>
        </GnomeWindow>
        <GnomeWindow title="Grade">
          <div className="text-center -mt-2">
            <span className="font-ubuntu text-4xl font-bold text-ubuntu-orange">
              {report.grade}
            </span>
          </div>
        </GnomeWindow>
        <GnomeWindow title="Result">
          <div className="text-center -mt-2">
            {report.passFail === "pass" ? (
              <CheckCircle className="w-10 h-10 mx-auto text-ubuntu-maximize" />
            ) : (
              <XCircle className="w-10 h-10 mx-auto text-ubuntu-close" />
            )}
            <p className="font-ubuntu text-sm mt-1 capitalize">
              {report.passFail}
            </p>
          </div>
        </GnomeWindow>
        <GnomeWindow title="Disposition Match">
          <div className="text-center -mt-2">
            {call.disposition?.dispositionMatch === true ? (
              <CheckCircle className="w-10 h-10 mx-auto text-ubuntu-maximize" />
            ) : call.disposition?.dispositionMatch === false ? (
              <AlertTriangle className="w-10 h-10 mx-auto text-ubuntu-minimize" />
            ) : (
              <FileText className="w-10 h-10 mx-auto text-gray-400" />
            )}
            <p className="font-ubuntu text-xs mt-1 text-gray-500">
              {call.disposition?.dispositionMatch === true
                ? "Match"
                : call.disposition?.dispositionMatch === false
                  ? "Mismatch"
                  : "No agent disposition"}
            </p>
          </div>
        </GnomeWindow>
      </div>

      {/* Summary & Participants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GnomeWindow title="Call Summary">
          <p className="font-ubuntu text-sm leading-relaxed">
            {report.summary}
          </p>
        </GnomeWindow>

        <GnomeWindow title="Participants">
          <div className="space-y-3">
            {call.participants.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <User className="w-4 h-4 text-gray-400" />
                <div className="flex-1">
                  <Input
                    value={p.name}
                    onChange={(e) =>
                      updateParticipantName(p.id, e.target.value)
                    }
                    onBlur={(e) =>
                      updateParticipantName(p.id, e.target.value)
                    }
                  />
                  <p className="font-ubuntu text-xs text-gray-500 mt-0.5 capitalize">
                    {p.role} · confidence: {Math.round(p.confidence * 100)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </GnomeWindow>
      </div>

      {/* Disposition Review */}
      <GnomeWindow title="Disposition Review">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 rounded-gnome-sm bg-gray-100 dark:bg-[#333]">
            <p className="font-ubuntu text-xs text-gray-500 mb-1">
              Agent Selected
            </p>
            <p className="font-ubuntu font-medium">
              {call.disposition?.agentSelectedDisposition
                ? formatDisposition(call.disposition.agentSelectedDisposition)
                : "Not provided"}
            </p>
          </div>
          <div className="p-3 rounded-gnome-sm bg-ubuntu-orange/10">
            <p className="font-ubuntu text-xs text-gray-500 mb-1">
              AI Recommended
            </p>
            <p className="font-ubuntu font-medium text-ubuntu-orange">
              {call.disposition?.aiRecommendedDisposition
                ? formatDisposition(call.disposition.aiRecommendedDisposition)
                : "—"}
            </p>
          </div>
          <div className="p-3 rounded-gnome-sm bg-gray-100 dark:bg-[#333]">
            <p className="font-ubuntu text-xs text-gray-500 mb-1">Rationale</p>
            <p className="font-ubuntu text-sm">
              {call.disposition?.rationale}
            </p>
          </div>
        </div>
      </GnomeWindow>

      {/* Audit Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AuditList
          title="What Was Wrong"
          items={report.whatWentWrong}
          icon={XCircle}
          color="text-ubuntu-close"
        />
        <AuditList
          title="What Was Done Correctly"
          items={report.whatWentWell}
          icon={CheckCircle}
          color="text-ubuntu-maximize"
        />
        <AuditList
          title="What Should Have Been Done Better"
          items={report.whatShouldHaveBeenDone}
          icon={AlertTriangle}
          color="text-ubuntu-minimize"
        />
        <AuditList
          title="Focus Areas for the Agent"
          items={report.focusAreas}
          icon={FileText}
          color="text-ubuntu-orange"
        />
      </div>

      {/* Scoring Rubric */}
      <GnomeWindow title="Scoring Rubric">
        <div className="space-y-4">
          {rubricEntries.map(([key, item]) => (
            <div key={key}>
              <div className="flex justify-between mb-1">
                <span className="font-ubuntu text-sm capitalize">
                  {key.replace(/_/g, " ")}
                </span>
                <span className="font-ubuntu-mono text-xs text-gray-500">
                  {item.score}/{item.max}
                </span>
              </div>
              <ProgressBar value={item.score} max={item.max} />
              <p className="font-ubuntu text-xs text-gray-500 mt-1">
                {item.notes}
              </p>
            </div>
          ))}
        </div>
      </GnomeWindow>

      {/* Team Leader Feedback */}
      <GnomeWindow title="Team Leader Feedback">
        <p className="font-ubuntu text-sm leading-relaxed italic">
          &ldquo;{report.teamLeaderFeedback}&rdquo;
        </p>
      </GnomeWindow>

      {report.managerSummary ? (
        <GnomeWindow title="Manager Summary">
          <p className="font-ubuntu text-sm leading-relaxed">
            {report.managerSummary}
          </p>
        </GnomeWindow>
      ) : null}

      {(report.complianceCheck?.length ?? 0) > 0 && (
        <GnomeWindow title="Compliance Check">
          <ul className="space-y-2">
            {report.complianceCheck!.map((item, i) => (
              <li
                key={`${item.phrase}-${i}`}
                className="flex items-start justify-between gap-3 font-ubuntu text-sm"
              >
                <span>
                  {item.timestamp ? `${item.timestamp} ` : ""}
                  {item.phrase}
                </span>
                <span
                  className={cn(
                    "font-ubuntu-mono text-xs shrink-0 capitalize",
                    item.status === "missing"
                      ? "text-ubuntu-close"
                      : item.status === "paraphrased"
                        ? "text-ubuntu-minimize"
                        : "text-ubuntu-maximize"
                  )}
                >
                  {item.status}
                </span>
              </li>
            ))}
          </ul>
        </GnomeWindow>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GnomeWindow title="Immediate Coaching Notes">
          <p className="font-ubuntu text-sm leading-relaxed whitespace-pre-line">
            {report.immediateCoachingNotes}
          </p>
        </GnomeWindow>

        <GnomeWindow title="Priority Improvement Focus">
          <div className="p-4 rounded-gnome-sm bg-ubuntu-orange/10 border border-ubuntu-orange/20">
            <p className="font-ubuntu text-sm font-medium">
              {report.priorityImprovementFocus}
            </p>
          </div>
        </GnomeWindow>
      </div>

      {/* Transcript */}
      <GnomeWindow title="Full Transcript">
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {call.transcript.map((seg) => (
            <div
              key={seg.id}
              className={cn(
                "flex gap-3 p-3 rounded-gnome-sm",
                seg.speakerLabel.toLowerCase().includes("agent")
                  ? "bg-ubuntu-orange/5"
                  : "bg-gray-100 dark:bg-[#333]"
              )}
            >
              <div className="shrink-0 w-20">
                <span className="font-ubuntu-mono text-xs text-gray-500">
                  {formatTimestamp(seg.startTime)}
                </span>
                <p
                  className={cn(
                    "font-ubuntu text-xs font-medium mt-0.5",
                    seg.speakerLabel.toLowerCase().includes("agent")
                      ? "text-ubuntu-orange"
                      : "text-blue-500"
                  )}
                >
                  {seg.speakerLabel}
                </p>
              </div>
              <p className="font-ubuntu text-sm flex-1">{seg.text}</p>
            </div>
          ))}
        </div>
      </GnomeWindow>
    </div>
  );
}

function AuditList({
  title,
  items,
  icon: Icon,
  color,
}: {
  title: string;
  items: string[];
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <GnomeWindow title={title}>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 font-ubuntu text-sm">
            <Icon className={cn("w-4 h-4 shrink-0 mt-0.5", color)} />
            {item}
          </li>
        ))}
      </ul>
    </GnomeWindow>
  );
}
