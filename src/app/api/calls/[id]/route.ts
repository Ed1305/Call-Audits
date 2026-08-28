import { NextRequest, NextResponse } from "next/server";
import { db, initDatabase } from "@/lib/db";

initDatabase();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const call = db.callRecords.findById(id);
  if (!call) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }

  const participants = db.callParticipants.findByCallId(id);
  const transcript = db.callTranscriptSegments.findByCallId(id);
  const disposition = db.callDispositions.findByCallId(id) || null;
  const auditReport = db.callAuditReports.findByCallId(id);

  const parsedReport = auditReport
    ? {
        summary: auditReport.summary,
        whatWentWrong: safeParseArray(auditReport.whatWentWrong),
        whatWentWell: safeParseArray(auditReport.whatWentWell),
        whatShouldHaveBeenDone: safeParseArray(
          auditReport.whatShouldHaveBeenDone
        ),
        focusAreas: safeParseArray(auditReport.focusAreas),
        teamLeaderFeedback: auditReport.teamLeaderFeedback,
        immediateCoachingNotes: safeParseCoachingNotes(
          auditReport.immediateCoachingNotes
        ),
        priorityImprovementFocus: auditReport.priorityImprovementFocus,
        overallScore: auditReport.overallScore,
        grade: auditReport.grade,
        passFail: auditReport.passFail,
        rubric: safeParseObject(auditReport.rubricJson),
        managerSummary: auditReport.managerSummary || "",
        integrityWarnings: safeParseArray(auditReport.integrityWarnings),
        complianceCheck: safeParseUnknownArray(auditReport.complianceCheck),
      }
    : null;

  return NextResponse.json({
    ...call,
    audioUrl: `/api/calls/${id}/audio`,
    participants,
    transcript,
    disposition,
    auditReport: parsedReport,
  });
}

function safeParseCoachingNotes(value: string | null): string {
  if (!value) return "";
  // Legacy: stored as JSON array
  if (value.startsWith("[")) {
    try {
      const arr = JSON.parse(value) as string[];
      return arr.join("\n");
    } catch {
      return value;
    }
  }
  return value;
}

function safeParseArray(json: string | null): string[] {
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

function safeParseObject(
  json: string | null
): Record<string, { score: number; max: number; notes: string }> {
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function safeParseUnknownArray(json: string | null): unknown[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const runtime = "nodejs";
