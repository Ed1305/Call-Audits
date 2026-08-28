import { NextResponse } from "next/server";
import { db, initDatabase } from "@/lib/db";

initDatabase();

export async function GET() {
  const allCalls = db.callRecords.findAll();
  const completed = allCalls.filter((c) => c.uploadStatus === "completed");
  const processing = allCalls.filter(
    (c) => !["completed", "failed"].includes(c.uploadStatus)
  );
  const failed = allCalls.filter((c) => c.uploadStatus === "failed");

  const reports = db.callAuditReports.findAll();
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

  const recentCalls = allCalls.slice(0, 10).map((call) => {
    const report = db.callAuditReports.findByCallId(call.id);
    return {
      id: call.id,
      filename: call.filename,
      uploadStatus: call.uploadStatus,
      audioDuration: call.audioDuration,
      createdAt: call.createdAt,
      overallScore: report?.overallScore ?? null,
      grade: report?.grade ?? null,
    };
  });

  return NextResponse.json({
    total: allCalls.length,
    completed: completed.length,
    processing: processing.length,
    failed: failed.length,
    avgScore,
    passRate,
    recentCalls,
  });
}

export const runtime = "nodejs";
