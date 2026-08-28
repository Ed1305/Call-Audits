"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Phone, Search } from "lucide-react";
import { GnomeWindow } from "@/components/ui/GnomeWindow";
import { Input } from "@/components/ui/Input";
import { GnomeSpinner } from "@/components/ui/Spinner";
import { formatDate, formatDuration } from "@/lib/utils";

interface CallItem {
  id: string;
  filename: string;
  uploadStatus: string;
  audioDuration: number | null;
  agentDisposition: string | null;
  overallScore: number | null;
  grade: string | null;
  passFail: string | null;
  createdAt: string;
}

export default function CallsPage() {
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/calls")
      .then((r) => r.json())
      .then(setCalls)
      .finally(() => setLoading(false));
  }, []);

  const filtered = calls.filter((c) =>
    c.filename.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-ubuntu text-2xl font-bold">Call History</h1>
          <p className="font-ubuntu text-sm text-gray-500 mt-1">
            {calls.length} call{calls.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <Link
          href="/upload"
          className="font-ubuntu text-sm text-ubuntu-orange hover:underline"
        >
          + Upload new call
        </Link>
      </div>

      <GnomeWindow title="All Calls">
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by filename..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <GnomeSpinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Phone className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="font-ubuntu text-gray-500">
              {search ? "No matching calls" : "No calls yet"}
            </p>
          </div>
        ) : (
          <table className="gnome-table -mx-1">
            <thead>
              <tr>
                <th>Filename</th>
                <th>Status</th>
                <th>Disposition</th>
                <th>Score</th>
                <th>Duration</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((call) => (
                <tr key={call.id}>
                  <td>
                    <Link
                      href={
                        call.uploadStatus === "completed"
                          ? `/calls/${call.id}`
                          : `/calls/${call.id}/processing`
                      }
                      className="text-ubuntu-orange hover:underline font-medium"
                    >
                      {call.filename}
                    </Link>
                  </td>
                  <td>
                    <span className="font-ubuntu text-xs capitalize">
                      {call.uploadStatus}
                    </span>
                  </td>
                  <td className="text-xs">
                    {call.agentDisposition || "—"}
                  </td>
                  <td className="font-ubuntu-mono text-xs">
                    {call.overallScore != null
                      ? `${call.overallScore} (${call.grade})`
                      : "—"}
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
  );
}
