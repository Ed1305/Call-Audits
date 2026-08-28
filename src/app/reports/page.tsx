"use client";

import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, Users, Award } from "lucide-react";
import { GnomeWindow } from "@/components/ui/GnomeWindow";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { GnomeSpinner } from "@/components/ui/Spinner";

interface ReportData {
  totalCalls: number;
  avgScore: number;
  passRate: number;
  gradeDistribution: Record<string, number>;
  rubricAverages: Record<string, number>;
  dispositionAccuracy: number;
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <GnomeSpinner className="w-10 h-10" />
      </div>
    );
  }

  const d = data || {
    totalCalls: 0,
    avgScore: 0,
    passRate: 0,
    gradeDistribution: {},
    rubricAverages: {},
    dispositionAccuracy: 0,
  };

  const grades = ["A", "B", "C", "D", "F"];
  const maxGradeCount = Math.max(
    ...grades.map((g) => d.gradeDistribution[g] || 0),
    1
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-ubuntu text-2xl font-bold">QA Reports</h1>
        <p className="font-ubuntu text-sm text-gray-500 mt-1">
          Performance analytics across all audited calls
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={BarChart3} label="Total Audits" value={d.totalCalls} />
        <StatCard
          icon={TrendingUp}
          label="Average Score"
          value={`${d.avgScore}%`}
        />
        <StatCard icon={Award} label="Pass Rate" value={`${d.passRate}%`} />
        <StatCard
          icon={Users}
          label="Disposition Accuracy"
          value={`${d.dispositionAccuracy}%`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GnomeWindow title="Grade Distribution">
          {d.totalCalls === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {grades.map((grade) => {
                const count = d.gradeDistribution[grade] || 0;
                return (
                  <div key={grade} className="flex items-center gap-3">
                    <span className="font-ubuntu font-bold w-6 text-ubuntu-orange">
                      {grade}
                    </span>
                    <div className="flex-1 h-6 bg-gray-200 dark:bg-[#444] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-ubuntu-orange rounded-full transition-all"
                        style={{
                          width: `${(count / maxGradeCount) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="font-ubuntu-mono text-xs w-8 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </GnomeWindow>

        <GnomeWindow title="Rubric Averages">
          {d.totalCalls === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-4">
              {Object.entries(d.rubricAverages).map(([key, avg]) => (
                <ProgressBar
                  key={key}
                  label={key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  value={avg}
                  max={getRubricMax(key)}
                />
              ))}
            </div>
          )}
        </GnomeWindow>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <GnomeWindow title={label}>
      <div className="flex items-center gap-4 -mt-2">
        <Icon className="w-8 h-8 text-ubuntu-orange" />
        <span className="font-ubuntu text-3xl font-bold">{value}</span>
      </div>
    </GnomeWindow>
  );
}

function EmptyState() {
  return (
    <p className="font-ubuntu text-sm text-gray-500 text-center py-8">
      No audit data available yet. Upload calls to see reports.
    </p>
  );
}

function getRubricMax(key: string): number {
  const maxes: Record<string, number> = {
    opening_greeting: 10,
    verification_compliance: 10,
    understanding_probing: 15,
    communication_clarity: 10,
    empathy_professionalism: 10,
    resolution_accuracy: 20,
    call_control_ownership: 10,
    disposition_accuracy: 10,
    closing_next_steps: 5,
  };
  return maxes[key] || 10;
}
