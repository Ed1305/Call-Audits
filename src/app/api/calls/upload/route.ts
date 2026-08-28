import { NextRequest, NextResponse, after } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { db, initDatabase, resolveScorecard } from "@/lib/db";
import { processCall } from "@/lib/processing/pipeline";

initDatabase();

const ALLOWED_EXTENSIONS = [".mp3", ".wav", ".m4a", ".ogg"];
const MAX_SIZE = 100 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const agentDisposition = formData.get("agentDisposition") as string | null;
    const scorecardIdRaw = formData.get("scorecardId") as string | null;
    const agentNameRaw = formData.get("agentName") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: mp3, wav, m4a, ogg" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum 100MB." },
        { status: 400 }
      );
    }

    const uploadDir = path.resolve(process.env.UPLOAD_DIR || "./data/uploads");
    await mkdir(uploadDir, { recursive: true });

    const callId = uuidv4();
    const storedName = `${callId}${ext}`;
    const filePath = path.join(uploadDir, storedName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const now = new Date().toISOString();
    const scorecard = resolveScorecard(scorecardIdRaw);

    db.callRecords.insert({
      id: callId,
      filename: file.name,
      originalPath: filePath,
      audioDuration: null,
      uploadStatus: "uploaded",
      agentDisposition: agentDisposition || null,
      agentNameHint: agentNameRaw?.trim() || null,
      scorecardId: scorecard.id,
      processingError: null,
      createdAt: now,
      updatedAt: now,
    });

    after(async () => {
      console.log(`[pipeline] Starting processing for call ${callId}`);
      await processCall(callId);
      console.log(`[pipeline] Finished processing for call ${callId}`);
    });

    return NextResponse.json({
      id: callId,
      filename: file.name,
      status: "uploaded",
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
/** Gemini listen + long Whisper jobs need headroom */
export const maxDuration = 800;
