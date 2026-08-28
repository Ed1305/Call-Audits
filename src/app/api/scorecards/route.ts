import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { criteriaMaxSum, db, initDatabase } from "@/lib/db";
import type { CampaignScorecard, RubricCriterion } from "@/lib/db/schema";
import { buildDefaultScorecard } from "@/lib/db/default-scorecard";

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
    const description =
      typeof rec.description === "string" ? rec.description : "";
    const autoFailIf =
      typeof rec.autoFailIf === "string" && rec.autoFailIf.trim()
        ? rec.autoFailIf.trim()
        : undefined;
    out.push({
      key,
      label: label || key,
      max,
      description,
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

function fromBody(
  body: Record<string, unknown>,
  existing?: CampaignScorecard
): { scorecard?: Omit<CampaignScorecard, "id" | "createdAt">; error?: string } {
  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : existing?.name;
  if (!name) return { error: "Name is required" };

  const criteria = parseCriteria(body.criteria) ?? existing?.criteria;
  if (!criteria?.length) return { error: "At least one criterion is required" };

  const sum = criteriaMaxSum(criteria);
  if (sum !== 100) {
    return { error: `Criteria max values must sum to 100 (got ${sum})` };
  }

  const dispositionCodes =
    parseDispositionCodes(body.dispositionCodes).length > 0
      ? parseDispositionCodes(body.dispositionCodes)
      : existing?.dispositionCodes ?? [];

  if (!dispositionCodes.length) {
    return { error: "At least one disposition code is required" };
  }

  return {
    scorecard: {
      name,
      scriptText:
        typeof body.scriptText === "string"
          ? body.scriptText
          : existing?.scriptText ?? "",
      mandatoryPhrases: Array.isArray(body.mandatoryPhrases)
        ? asStringArray(body.mandatoryPhrases)
        : existing?.mandatoryPhrases ?? [],
      prohibitedClaims: Array.isArray(body.prohibitedClaims)
        ? asStringArray(body.prohibitedClaims)
        : existing?.prohibitedClaims ?? [],
      criteria,
      dispositionCodes,
      isDefault: Boolean(body.isDefault) || existing?.isDefault || false,
      updatedAt: new Date().toISOString(),
    },
  };
}

export async function GET() {
  return NextResponse.json(db.scorecards.findAll());
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = fromBody(body);
    if (parsed.error || !parsed.scorecard) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const now = new Date().toISOString();
    const seed = buildDefaultScorecard(now);
    const record: CampaignScorecard = {
      ...seed,
      ...parsed.scorecard,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      isDefault:
        parsed.scorecard.isDefault || db.scorecards.findAll().length === 0,
    };

    db.scorecards.insert(record);
    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Create failed" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
