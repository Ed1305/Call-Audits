const STORAGE_KEY = "callaudit.history.v1";
const MAX_CALLS = 80;

export interface HistoryListItem {
  id: string;
  filename: string;
  uploadStatus: string;
  audioDuration: number | null;
  agentDisposition: string | null;
  overallScore: number | null;
  grade: string | null;
  passFail: string | null;
  createdAt: string;
}

interface HistoryFile {
  calls: Record<string, unknown>;
}

function emptyFile(): HistoryFile {
  return { calls: {} };
}

function readFile(): HistoryFile {
  if (typeof window === "undefined") return emptyFile();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyFile();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyFile();
    const calls = (parsed as { calls?: unknown }).calls;
    if (!calls || typeof calls !== "object") return emptyFile();
    return { calls: calls as Record<string, unknown> };
  } catch {
    return emptyFile();
  }
}

function writeFile(file: HistoryFile): void {
  if (typeof window === "undefined") return;
  const ids = Object.keys(file.calls);
  if (ids.length > MAX_CALLS) {
    const sorted = ids.sort((a, b) => {
      const da = String(
        (file.calls[a] as { createdAt?: string } | undefined)?.createdAt || ""
      );
      const db = String(
        (file.calls[b] as { createdAt?: string } | undefined)?.createdAt || ""
      );
      return da.localeCompare(db);
    });
    for (const id of sorted.slice(0, ids.length - MAX_CALLS)) {
      delete file.calls[id];
    }
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
}

function asListItem(detail: Record<string, unknown>): HistoryListItem | null {
  const id = typeof detail.id === "string" ? detail.id : "";
  if (!id) return null;
  const report =
    detail.auditReport && typeof detail.auditReport === "object"
      ? (detail.auditReport as Record<string, unknown>)
      : {};
  return {
    id,
    filename: typeof detail.filename === "string" ? detail.filename : "Call",
    uploadStatus:
      typeof detail.uploadStatus === "string" ? detail.uploadStatus : "completed",
    audioDuration:
      typeof detail.audioDuration === "number" ? detail.audioDuration : null,
    agentDisposition:
      typeof detail.agentDisposition === "string"
        ? detail.agentDisposition
        : null,
    overallScore:
      typeof report.overallScore === "number" ? report.overallScore : null,
    grade: typeof report.grade === "string" ? report.grade : null,
    passFail: typeof report.passFail === "string" ? report.passFail : null,
    createdAt:
      typeof detail.createdAt === "string"
        ? detail.createdAt
        : new Date().toISOString(),
  };
}

/** Persist a finished audit in this browser (no server disk required). */
export function rememberCall(detail: unknown): void {
  if (!detail || typeof detail !== "object") return;
  const rec = detail as Record<string, unknown>;
  if (typeof rec.id !== "string") return;
  if (rec.uploadStatus !== "completed") return;
  const file = readFile();
  file.calls[rec.id] = rec;
  writeFile(file);
}

export function getRememberedCall<T>(id: string): T | null {
  const rec = readFile().calls[id];
  if (!rec || typeof rec !== "object") return null;
  return rec as T;
}

export function listRememberedCalls(): HistoryListItem[] {
  const items: HistoryListItem[] = [];
  for (const rec of Object.values(readFile().calls)) {
    if (!rec || typeof rec !== "object") continue;
    const item = asListItem(rec as Record<string, unknown>);
    if (item) items.push(item);
  }
  return items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function mergeCallLists(
  remote: HistoryListItem[],
  local: HistoryListItem[]
): HistoryListItem[] {
  const map = new Map<string, HistoryListItem>();
  for (const c of local) map.set(c.id, c);
  for (const c of remote) map.set(c.id, c);
  return [...map.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
