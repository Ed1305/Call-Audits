import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function scoreToGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function scoreToPassFail(score: number): string {
  return score >= 70 ? "pass" : "fail";
}

export const DISPOSITION_CODES = [
  "CALLBK",
  "CC",
  "CNP",
  "DNC",
  "DNQ",
  "DNQCV",
  "DNQNV",
  "DNQS",
  "DNQU",
  "LB",
  "N",
  "NI",
  "NOA",
  "SALE",
  "TS",
  "V",
  "WN",
] as const;

export type DispositionCode = (typeof DISPOSITION_CODES)[number];

/** Human-readable labels for agent disposition codes */
export const DISPOSITION_LABELS: Record<DispositionCode, string> = {
  CALLBK: "Callback Scheduled",
  CC: "Call Cut",
  CNP: "CallBack No Presentation",
  DNC: "Do Not Call",
  DNQ: "Did Not Qualify",
  DNQCV: "Do Not Qualified Car Value",
  DNQNV: "Do Not Qualified No Vehicule",
  DNQS: "Do Not Qualified Salary Band",
  DNQU: "Do Not Qualified Unemployed",
  LB: "Language Barrier",
  N: "No Answer",
  NI: "Not Interested",
  NOA: "Not Available",
  SALE: "Sale Completed",
  TS: "TroubleShooter",
  V: "Voicemail",
  WN: "Wrong Number",
};

/** @deprecated use DISPOSITION_CODES — kept for simple string lists */
export const DISPOSITION_OPTIONS = DISPOSITION_CODES;

export function formatDisposition(code: string): string {
  const label = DISPOSITION_LABELS[code as DispositionCode];
  return label ? `${code} — ${label}` : code;
}

export const PROCESSING_STEPS = [
  { key: "uploaded", label: "Uploaded" },
  { key: "listening", label: "Listening to call" },
  { key: "transcribing", label: "Transcribing" },
  { key: "diarizing", label: "Diarizing speakers" },
  { key: "analyzing", label: "Team-leader QA review" },
  { key: "completed", label: "Completed" },
] as const;
