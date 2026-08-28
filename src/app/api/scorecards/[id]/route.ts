import { NextRequest, NextResponse } from "next/server";
import { criteriaMaxSum, db, initDatabase } from "@/lib/db";
import type { CampaignScorecard, RubricCriterion } from "@/lib/db/schema";

initDatabase();

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : String(v ?? "").trim()))
    .filter(Boolean);
}

function parseCriteria(raw: unknown): RubricCriterion[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: RubricCriterion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const rec = item as Record<string, unknown>;
    const key = typeof rec.key === "string" ? rec.key.trim() : "";
    const label = typeof rec.label === "string" ? rec.label.trim() : key;
    const max = Number(rec.max);
    if (!key || !Number.isFinite(max) || max < 0) return null;
    const anchorsRaw =
      rec.anchors && typeof rec.anchors === "object"
        ? (rec.anchors as Record<string, unknown>)
        : {};
    const autoFailIf =
      typeof rec.autoFailIf === "string" && rec.autoFailIf.trim()
        ? rec.autoFailIf.trim()
        : undefined;
    out.push({
      key,
      label: label || key,
      max,
      description: typeof rec.description === "string" ? rec.description : "",
      anchors: {
        excellent: String(anchorsRaw.excellent ?? ""),
        adequate: String(anchorsRaw.adequate ?? ""),
        poor: String(anchorsRaw.poor ?? ""),
      },
      ...(autoFailIf ? { autoFailIf } : {}),
    });
  }
  return out;
}

function parseDispositionCodes(
  raw: unknown
): CampaignScorecard["dispositionCodes"] {
  if (!Array.isArray(raw)) return [];
  const out: CampaignScorecard["dispositionCodes"] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const code = typeof rec.code === "string" ? rec.code.trim() : "";
    if (!code) continue;
    out.push({
      code,
      label: typeof rec.label === "string" ? rec.label : code,
      whenToUse: typeof rec.whenToUse === "string" ? rec.whenToUse : "",
    });
  }
  return out;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const card = db.scorecards.findById(id);
  if (!card) {
    return NextResponse.json({ error: "Scorecard not found" }, { status: 404 });
  }
  return NextResponse.json(card);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = db.scorecards.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Scorecard not found" }, { status: 404 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const criteria = parseCriteria(body.criteria) ?? existing.criteria;
    const sum = criteriaMaxSum(criteria);
    if (sum !== 100) {
      return NextResponse.json(
        { error: `Criteria max values must sum to 100 (got ${sum})` },
        { status: 400 }
      );
    }

    const dispositionCodes =
      parseDispositionCodes(body.dispositionCodes).length > 0
        ? parseDispositionCodes(body.dispositionCodes)
        : existing.dispositionCodes;

    const updates: Partial<CampaignScorecard> = {
      name:
        typeof body.name === "string" && body.name.trim()
          ? body.name.trim()
          : existing.name,
      scriptText:
        typeof body.scriptText === "string"
          ? body.scriptText
          : existing.scriptText,
      mandatoryPhrases: Array.isArray(body.mandatoryPhrases)
        ? asStringArray(body.mandatoryPhrases)
        : existing.mandatoryPhrases,
      prohibitedClaims: Array.isArray(body.prohibitedClaims)
        ? asStringArray(body.prohibitedClaims)
        : existing.prohibitedClaims,
      criteria,
      dispositionCodes,
      updatedAt: new Date().toISOString(),
    };

    if (typeof body.isDefault === "boolean") {
      updates.isDefault = body.isDefault;
    }

    db.scorecards.update(id, updates);
    const saved = db.scorecards.findById(id);
    return NextResponse.json(saved);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = db.scorecards.delete(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";
