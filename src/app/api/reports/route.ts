import { NextResponse } from "next/server";
import { db, initDatabase } from "@/lib/db";

initDatabase();

export async function GET() {
  const reports = db.callAuditReports.findAll();
  const dispositions = db.callDispositions.findAll();

  const scores = reports
    .map((r) => r.overallScore)
    .filter((s): s is number => s != null);
  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;

  const passCount = reports.filter((r) => r.passFail === "pass").length;
  const passRate =
    reports.length > 0 ? Math.round((passCount / reports.length) * 100) : 0;

  const gradeDistribution: Record<string, number> = {};
  for (const r of reports) {
    if (r.grade) {
      gradeDistribution[r.grade] = (gradeDistribution[r.grade] || 0) + 1;
    }
  }

  const rubricTotals: Record<string, { sum: number; count: number }> = {};
  for (const r of reports) {
    if (!r.rubricJson) continue;
    try {
      const rubric = JSON.parse(r.rubricJson) as Record<
        string,
        { score: number; max: number }
      >;
      for (const [key, item] of Object.entries(rubric)) {
        if (!rubricTotals[key]) rubricTotals[key] = { sum: 0, count: 0 };
        rubricTotals[key].sum += item.score;
        rubricTotals[key].count += 1;
      }
    } catch {
      /* skip malformed */
    }
  }

  const rubricAverages: Record<string, number> = {};
  for (const [key, { sum, count }] of Object.entries(rubricTotals)) {
    rubricAverages[key] = Math.round((sum / count) * 10) / 10;
  }

  const matchedDispositions = dispositions.filter(
    (d) => d.dispositionMatch === true
  ).length;
  const dispositionAccuracy =
    dispositions.length > 0
      ? Math.round((matchedDispositions / dispositions.length) * 100)
      : 0;

  return NextResponse.json({
    totalCalls: reports.length,
    avgScore,
    passRate,
    gradeDistribution,
    rubricAverages,
    dispositionAccuracy,
  });
}

export const runtime = "nodejs";
