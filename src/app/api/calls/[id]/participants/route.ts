import { NextRequest, NextResponse } from "next/server";
import { db, initDatabase } from "@/lib/db";

initDatabase();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;
  const { participantId, name } = await request.json();

  if (!participantId || !name) {
    return NextResponse.json(
      { error: "participantId and name required" },
      { status: 400 }
    );
  }

  db.callParticipants.update(participantId, { name });

  return NextResponse.json({ success: true });
}

export const runtime = "nodejs";
