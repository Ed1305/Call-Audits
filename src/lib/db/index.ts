import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { CampaignScorecard } from "./schema";
import { buildDefaultScorecard } from "./default-scorecard";

export interface DbCallRecord {
  id: string;
  filename: string;
  originalPath: string;
  audioDuration: number | null;
  uploadStatus: string;
  agentDisposition: string | null;
  agentNameHint?: string | null;
  scorecardId: string | null;
  processingError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DbCallParticipant {
  id: string;
  callId: string;
  role: string;
  name: string;
  confidence: number;
}

export interface DbTranscriptSegment {
  id: string;
  callId: string;
  speakerLabel: string;
  startTime: number;
  endTime: number;
  text: string;
}

export interface DbCallDisposition {
  id: string;
  callId: string;
  agentSelectedDisposition: string | null;
  aiRecommendedDisposition: string | null;
  dispositionMatch: boolean | null;
  rationale: string | null;
}

export interface DbAuditReport {
  id: string;
  callId: string;
  summary: string | null;
  whatWentWrong: string | null;
  whatWentWell: string | null;
  whatShouldHaveBeenDone: string | null;
  focusAreas: string | null;
  teamLeaderFeedback: string | null;
  immediateCoachingNotes: string | null;
  priorityImprovementFocus: string | null;
  overallScore: number | null;
  grade: string | null;
  passFail: string | null;
  rubricJson: string | null;
  rawLlmJson: string | null;
  managerSummary: string | null;
  integrityWarnings: string | null;
  complianceCheck: string | null;
  createdAt: string;
}

interface Database {
  callRecords: DbCallRecord[];
  callParticipants: DbCallParticipant[];
  callTranscriptSegments: DbTranscriptSegment[];
  callDispositions: DbCallDisposition[];
  callAuditReports: DbAuditReport[];
  scorecards: CampaignScorecard[];
}

const dbPath =
  process.env.DATABASE_PATH?.replace(/\.db$/, ".json") ||
  "./data/callaudit.json";

function getDbFilePath(): string {
  const resolved = path.resolve(dbPath);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return resolved;
}

function emptyDatabase(): Database {
  return {
    callRecords: [],
    callParticipants: [],
    callTranscriptSegments: [],
    callDispositions: [],
    callAuditReports: [],
    scorecards: [buildDefaultScorecard()],
  };
}

function ensureShape(raw: Database): Database {
  if (!Array.isArray(raw.callRecords)) raw.callRecords = [];
  if (!Array.isArray(raw.callParticipants)) raw.callParticipants = [];
  if (!Array.isArray(raw.callTranscriptSegments)) raw.callTranscriptSegments = [];
  if (!Array.isArray(raw.callDispositions)) raw.callDispositions = [];
  if (!Array.isArray(raw.callAuditReports)) raw.callAuditReports = [];
  if (!Array.isArray(raw.scorecards) || raw.scorecards.length === 0) {
    raw.scorecards = [buildDefaultScorecard()];
  }
  return raw;
}

function readDb(): Database {
  const file = getDbFilePath();
  if (!fs.existsSync(file)) {
    const empty = emptyDatabase();
    fs.writeFileSync(file, JSON.stringify(empty, null, 2));
    return empty;
  }
  const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as Database;
  const shaped = ensureShape(parsed);
  if (!Array.isArray((parsed as Database).scorecards) || parsed.scorecards.length === 0) {
    writeDb(shaped);
  }
  return shaped;
}

function writeDb(data: Database): void {
  // Compact JSON is faster to write/read at scale; pretty-print only in debug
  const pretty = process.env.DB_PRETTY === "true" || process.env.DB_PRETTY === "1";
  fs.writeFileSync(
    getDbFilePath(),
    pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data)
  );
}

export function initDatabase(): void {
  readDb();
}

/** Single atomic write for a finished audit — avoids N full-file rewrites. */
export function commitCallResult(input: {
  callId: string;
  callUpdates: Partial<DbCallRecord>;
  participants: DbCallParticipant[];
  segments: DbTranscriptSegment[];
  disposition: DbCallDisposition;
  report: DbAuditReport;
}): void {
  const data = readDb();
  const idx = data.callRecords.findIndex((r) => r.id === input.callId);
  if (idx >= 0) {
    data.callRecords[idx] = { ...data.callRecords[idx], ...input.callUpdates };
  }

  data.callParticipants = data.callParticipants.filter(
    (p) => p.callId !== input.callId
  );
  data.callTranscriptSegments = data.callTranscriptSegments.filter(
    (s) => s.callId !== input.callId
  );
  data.callDispositions = data.callDispositions.filter(
    (d) => d.callId !== input.callId
  );
  data.callAuditReports = data.callAuditReports.filter(
    (r) => r.callId !== input.callId
  );

  data.callParticipants.push(...input.participants);
  data.callTranscriptSegments.push(...input.segments);
  data.callDispositions.push(input.disposition);
  data.callAuditReports.push(input.report);
  writeDb(data);
}

// Table-like accessors
export const db = {
  callRecords: {
    insert: (record: Omit<DbCallRecord, never>) => {
      const data = readDb();
      data.callRecords.push(record);
      writeDb(data);
    },
    update: (
      id: string,
      updates: Partial<DbCallRecord>
    ) => {
      const data = readDb();
      const idx = data.callRecords.findIndex((r) => r.id === id);
      if (idx >= 0) {
        data.callRecords[idx] = { ...data.callRecords[idx], ...updates };
        writeDb(data);
      }
    },
    findById: (id: string) => {
      return readDb().callRecords.find((r) => r.id === id);
    },
    findAll: (sortDesc = true) => {
      const records = readDb().callRecords;
      return sortDesc
        ? [...records].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() -
              new Date(a.createdAt).getTime()
          )
        : records;
    },
    select: () => ({
      all: () => readDb().callRecords,
      where: (predicate: (r: DbCallRecord) => boolean) => ({
        limit: (n: number) =>
          readDb().callRecords.filter(predicate).slice(0, n),
        all: () => readDb().callRecords.filter(predicate),
        first: () => readDb().callRecords.find(predicate),
      }),
    }),
  },

  callParticipants: {
    insert: (record: DbCallParticipant) => {
      const data = readDb();
      data.callParticipants.push(record);
      writeDb(data);
    },
    update: (id: string, updates: Partial<DbCallParticipant>) => {
      const data = readDb();
      const idx = data.callParticipants.findIndex((p) => p.id === id);
      if (idx >= 0) {
        data.callParticipants[idx] = {
          ...data.callParticipants[idx],
          ...updates,
        };
        writeDb(data);
      }
    },
    findByCallId: (callId: string) =>
      readDb().callParticipants.filter((p) => p.callId === callId),
  },

  callTranscriptSegments: {
    insert: (record: DbTranscriptSegment) => {
      const data = readDb();
      data.callTranscriptSegments.push(record);
      writeDb(data);
    },
    findByCallId: (callId: string) =>
      readDb()
        .callTranscriptSegments.filter((s) => s.callId === callId)
        .sort((a, b) => a.startTime - b.startTime),
  },

  callDispositions: {
    insert: (record: DbCallDisposition) => {
      const data = readDb();
      data.callDispositions.push(record);
      writeDb(data);
    },
    findByCallId: (callId: string) =>
      readDb().callDispositions.find((d) => d.callId === callId),
    findAll: () => readDb().callDispositions,
  },

  callAuditReports: {
    insert: (record: DbAuditReport) => {
      const data = readDb();
      data.callAuditReports.push(record);
      writeDb(data);
    },
    findByCallId: (callId: string) =>
      readDb().callAuditReports.find((r) => r.callId === callId),
    findAll: () => readDb().callAuditReports,
  },

  scorecards: {
    insert: (record: CampaignScorecard) => {
      const data = readDb();
      if (record.isDefault) {
        data.scorecards = data.scorecards.map((s) => ({
          ...s,
          isDefault: false,
        }));
      }
      data.scorecards.push(record);
      writeDb(data);
    },
    update: (id: string, updates: Partial<CampaignScorecard>) => {
      const data = readDb();
      const idx = data.scorecards.findIndex((s) => s.id === id);
      if (idx < 0) return;
      if (updates.isDefault) {
        data.scorecards = data.scorecards.map((s) => ({
          ...s,
          isDefault: s.id === id,
        }));
      }
      data.scorecards[idx] = {
        ...data.scorecards[idx],
        ...updates,
        id: data.scorecards[idx].id,
      };
      writeDb(data);
    },
    delete: (id: string): { ok: boolean; error?: string } => {
      const data = readDb();
      if (data.scorecards.length <= 1) {
        return { ok: false, error: "Cannot delete the last remaining scorecard" };
      }
      const target = data.scorecards.find((s) => s.id === id);
      if (!target) return { ok: false, error: "Scorecard not found" };
      data.scorecards = data.scorecards.filter((s) => s.id !== id);
      if (target.isDefault && data.scorecards.length > 0) {
        data.scorecards[0] = { ...data.scorecards[0], isDefault: true };
      }
      writeDb(data);
      return { ok: true };
    },
    findById: (id: string) => readDb().scorecards.find((s) => s.id === id),
    findDefault: () =>
      readDb().scorecards.find((s) => s.isDefault) || readDb().scorecards[0],
    findAll: () =>
      [...readDb().scorecards].sort(
        (a, b) =>
          Number(b.isDefault) - Number(a.isDefault) ||
          a.name.localeCompare(b.name)
      ),
    setDefault: (id: string) => {
      const data = readDb();
      if (!data.scorecards.some((s) => s.id === id)) return;
      data.scorecards = data.scorecards.map((s) => ({
        ...s,
        isDefault: s.id === id,
        updatedAt: s.id === id ? new Date().toISOString() : s.updatedAt,
      }));
      writeDb(data);
    },
  },
};

export function resolveScorecard(
  id: string | null | undefined
): CampaignScorecard {
  if (id) {
    const found = db.scorecards.findById(id);
    if (found) return found;
  }
  const fallback = db.scorecards.findDefault();
  if (!fallback) {
    throw new Error("No campaign scorecards are configured");
  }
  return fallback;
}

export function criteriaMaxSum(criteria: { max: number }[]): number {
  return criteria.reduce((sum, c) => sum + (Number(c.max) || 0), 0);
}

export { uuidv4 };
