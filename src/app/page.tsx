"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Phone,
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
} from "lucide-react";
import { GnomeWindow } from "@/components/ui/GnomeWindow";
import { GnomeSpinner } from "@/components/ui/Spinner";
import { formatDate, formatDuration } from "@/lib/utils";

interface DashboardStats {
  total: number;
  completed: number;
  processing: number;
  failed: number;
  avgScore: number;
  passRate: number;
  recentCalls: {
    id: string;
    filename: string;
    uploadStatus: string;
    overallScore: number | null;
    grade: string | null;
    createdAt: string;
    audioDuration: number | null;
  }[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <GnomeSpinner className="w-10 h-10" />
      </div>
    );
  }

  const s = stats || {
    total: 0,
    completed: 0,
    processing: 0,
    failed: 0,
    avgScore: 0,
    passRate: 0,
    recentCalls: [],
  };

  const statCards = [
    {
      label: "Total Calls",
      value: s.total,
      icon: Phone,
      color: "text-ubuntu-orange",
    },
    {
      label: "Completed Audits",
      value: s.completed,
      icon: CheckCircle,
      color: "text-ubuntu-maximize",
    },
    {
      label: "Processing",
      value: s.processing,
      icon: Clock,
      color: "text-ubuntu-minimize",
    },
    {
      label: "Avg QA Score",
      value: s.avgScore ? `${s.avgScore}%` : "—",
      icon: TrendingUp,
      color: "text-ubuntu-orange",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-ubuntu text-2xl font-bold text-ubuntu-text-dark dark:text-ubuntu-text-light">
          Dashboard
        </h1>
        <p className="font-ubuntu text-sm text-gray-500 mt-1">
          Call quality assurance overview
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <GnomeWindow key={card.label} title={card.label}>
            <div className="flex items-center gap-4 -mt-2">
              <card.icon className={`w-8 h-8 ${card.color}`} />
              <span className="font-ubuntu text-3xl font-bold">{card.value}</span>
            </div>
          </GnomeWindow>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <GnomeWindow
            title="Recent Calls"
            actions={
              <Link
                href="/calls"
                className="font-ubuntu text-xs text-ubuntu-orange hover:underline"
              >
                View all
              </Link>
            }
          >
            {s.recentCalls.length === 0 ? (
              <div className="text-center py-12">
                <Phone className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="font-ubuntu text-gray-500">No calls audited yet</p>
                <Link
                  href="/upload"
                  className="inline-flex items-center gap-2 mt-4 font-ubuntu text-sm text-ubuntu-orange hover:underline"
                >
                  <Upload className="w-4 h-4" />
                  Upload your first call
                </Link>
              </div>
            ) : (
              <table className="gnome-table -mx-1">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Duration</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {s.recentCalls.map((call) => (
                    <tr key={call.id}>
                      <td>
                        <Link
                          href={`/calls/${call.id}`}
                          className="text-ubuntu-orange hover:underline font-medium"
                        >
                          {call.filename}
                        </Link>
                      </td>
                      <td>
                        <StatusBadge status={call.uploadStatus} />
                      </td>
                      <td>
                        {call.overallScore != null ? (
                          <span className="font-ubuntu-mono">
                            {call.overallScore}/100 ({call.grade})
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="font-ubuntu-mono text-xs">
                        {call.audioDuration
                          ? formatDuration(call.audioDuration)
                          : "—"}
                      </td>
                      <td className="text-xs text-gray-500">
                        {formatDate(call.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </GnomeWindow>
        </div>

        <GnomeWindow title="Quick Actions">
          <div className="space-y-3 -mt-1">
            <Link
              href="/upload"
              className="flex items-center gap-3 p-3 rounded-gnome-sm bg-ubuntu-orange/10 hover:bg-ubuntu-orange/20 transition-colors"
            >
              <Upload className="w-5 h-5 text-ubuntu-orange" />
              <div>
                <p className="font-ubuntu text-sm font-medium">Upload Call</p>
                <p className="font-ubuntu text-xs text-gray-500">
                  mp3, wav, m4a, ogg
                </p>
              </div>
            </Link>
            <Link
              href="/calls"
              className="flex items-center gap-3 p-3 rounded-gnome-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <Phone className="w-5 h-5 text-gray-400" />
              <div>
                <p className="font-ubuntu text-sm font-medium">Call History</p>
                <p className="font-ubuntu text-xs text-gray-500">
                  Browse all audited calls
                </p>
              </div>
            </Link>
            <Link
              href="/reports"
              className="flex items-center gap-3 p-3 rounded-gnome-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <TrendingUp className="w-5 h-5 text-gray-400" />
              <div>
                <p className="font-ubuntu text-sm font-medium">QA Reports</p>
                <p className="font-ubuntu text-xs text-gray-500">
                  Performance analytics
                </p>
              </div>
            </Link>
          </div>

          <div className="mt-6 pt-4 border-t border-ubuntu-border-light dark:border-ubuntu-border-dark">
            <p className="font-ubuntu text-xs text-gray-500 mb-2">
              Pass Rate
            </p>
            <div className="h-2 bg-gray-200 dark:bg-[#444] rounded-full overflow-hidden">
              <div
                className="h-full bg-ubuntu-maximize rounded-full transition-all"
                style={{ width: `${s.passRate}%` }}
              />
            </div>
            <p className="font-ubuntu-mono text-xs text-gray-500 mt-1">
              {s.passRate}% of calls passed QA
            </p>
          </div>
        </GnomeWindow>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    completed: {
      label: "Completed",
      className: "bg-ubuntu-maximize/20 text-green-700 dark:text-green-400",
    },
    failed: {
      label: "Failed",
      className: "bg-ubuntu-close/20 text-red-700 dark:text-red-400",
    },
    uploaded: {
      label: "Queued",
      className: "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300",
    },
    transcribing: {
      label: "Transcribing",
      className: "bg-ubuntu-orange/20 text-ubuntu-orange",
    },
    diarizing: {
      label: "Diarizing",
      className: "bg-ubuntu-orange/20 text-ubuntu-orange",
    },
    analyzing: {
      label: "Analyzing",
      className: "bg-ubuntu-orange/20 text-ubuntu-orange",
    },
  };

  const c = config[status] || config.uploaded;

  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-ubuntu font-medium ${c.className}`}
    >
      {c.label}
    </span>
  );
}
