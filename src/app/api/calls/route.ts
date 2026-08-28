import { NextResponse } from "next/server";
import { db, initDatabase } from "@/lib/db";

initDatabase();

export async function GET() {
  const calls = db.callRecords.findAll();

  const result = calls.map((call) => {
    const report = db.callAuditReports.findByCallId(call.id);
    return {
      id: call.id,
      filename: call.filename,
      uploadStatus: call.uploadStatus,
      audioDuration: call.audioDuration,
      agentDisposition: call.agentDisposition,
      createdAt: call.createdAt,
      overallScore: report?.overallScore ?? null,
      grade: report?.grade ?? null,
      passFail: report?.passFail ?? null,
    };
  });

  return NextResponse.json(result);
}

export const runtime = "nodejs";
