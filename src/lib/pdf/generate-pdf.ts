"use client";

import jsPDF from "jspdf";

interface CallDetail {
  id: string;
  filename: string;
  createdAt: string;
  audioDuration: number | null;
  agentDisposition: string | null;
  participants: { role: string; name: string }[];
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
  transcript: {
    speakerLabel: string;
    startTime: number;
    endTime: number;
    text: string;
  }[];
}

export async function generatePDF(call: CallDetail): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const report = call.auditReport!;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const addPage = () => {
    doc.addPage();
    y = margin;
  };

  const checkPage = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      addPage();
    }
  };

  const heading = (text: string, size = 13) => {
    checkPage(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(233, 84, 32);
    doc.text(text, margin, y);
    y += size * 0.45 + 5;
    doc.setTextColor(40, 40, 40);
  };

  const body = (text: string, size = 10) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, contentWidth);
    checkPage(lines.length * 4.5 + 2);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 4;
  };

  const bulletList = (items: string[]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const item of items) {
      const lines = doc.splitTextToSize(`• ${item}`, contentWidth - 4);
      checkPage(lines.length * 4.5);
      doc.text(lines, margin + 2, y);
      y += lines.length * 4.5 + 2;
    }
    y += 4;
  };

  const agent = call.participants.find((p) => p.role === "agent");
  const client = call.participants.find((p) => p.role === "client");

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(233, 84, 32);
  doc.text("CallAudit AI", margin, y);
  y += 10;

  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text("Call Quality Assurance Report", margin, y);
  y += 12;

  // Metadata block
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(248, 248, 248);
  doc.rect(margin, y, contentWidth, 36, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`Call ID: ${call.id}`, margin + 4, y + 8);
  doc.text(`Date: ${new Date(call.createdAt).toLocaleString()}`, margin + 4, y + 14);
  doc.text(`File: ${call.filename}`, margin + 4, y + 20);
  doc.text(`Agent: ${agent?.name || "Unknown"}`, margin + 4, y + 26);
  doc.text(`Client: ${client?.name || "Unknown"}`, margin + 4, y + 32);
  y += 44;

  // Score summary
  doc.setDrawColor(233, 84, 32);
  doc.setLineWidth(0.6);
  doc.rect(margin, y, contentWidth, 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(40, 40, 40);
  doc.text(
    `Score: ${report.overallScore}/100   Grade: ${report.grade}   Result: ${report.passFail?.toUpperCase()}`,
    margin + 4,
    y + 12
  );
  y += 26;

  // Summary
  heading("Transcript Summary");
  body(report.summary || "N/A");

  // Disposition
  heading("Disposition Review");
  body(
    `Agent Used: ${call.disposition?.agentSelectedDisposition || "Not provided"}`
  );
  body(
    `Recommended: ${call.disposition?.aiRecommendedDisposition || "N/A"}`
  );
  body(
    `Match: ${
      call.disposition?.dispositionMatch === true
        ? "Yes — Correct"
        : call.disposition?.dispositionMatch === false
          ? "No — Mismatch"
          : "N/A — agent disposition not provided"
    }`
  );
  body(`Rationale: ${call.disposition?.rationale || "N/A"}`);

  // Rubric breakdown
  heading("Score Breakdown");
  for (const [key, item] of Object.entries(report.rubric || {})) {
    const note = item.notes?.trim() ? ` — ${item.notes.trim()}` : "";
    body(
      `${key.replace(/_/g, " ")}: ${item.score} / ${item.max}${note}`
    );
  }

  if ((report.integrityWarnings?.length ?? 0) > 0) {
    heading("QA Integrity");
    bulletList(report.integrityWarnings || []);
  }

  if ((report.complianceCheck?.length ?? 0) > 0) {
    heading("Compliance Check");
    bulletList(
      (report.complianceCheck || []).map((item) => {
        const stamp = item.timestamp ? `${item.timestamp} ` : "";
        return `${stamp}${item.phrase} — ${item.status}`;
      })
    );
  }

  // Audit sections
  heading("What Went Wrong");
  bulletList(report.whatWentWrong);

  heading("What Went Well");
  bulletList(report.whatWentWell);

  heading("What Should Have Been Done Better");
  bulletList(report.whatShouldHaveBeenDone);

  heading("Focus Areas");
  bulletList(report.focusAreas);

  heading("Team Leader Feedback");
  body(report.teamLeaderFeedback || "N/A");

  heading("Manager Summary");
  body(report.managerSummary || "N/A");

  heading("Immediate Coaching Notes");
  body(report.immediateCoachingNotes || "N/A");

  heading("Priority Improvement Focus");
  body(report.priorityImprovementFocus || "N/A");

  // Full transcript
  addPage();
  heading("Full Transcript", 12);
  for (const seg of call.transcript) {
    const mins = Math.floor(seg.startTime / 60);
    const secs = Math.floor(seg.startTime % 60);
    const time = `${mins}:${secs.toString().padStart(2, "0")}`;
    body(`[${time}] ${seg.speakerLabel}: ${seg.text}`, 9);
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `CallAudit AI — Confidential QA Report — Page ${i} of ${pageCount}`,
      margin,
      doc.internal.pageSize.getHeight() - 8
    );
  }

  doc.save(`callaudit-${call.id.slice(0, 8)}-report.pdf`);
}
