export type HistoryJob = Record<string, unknown> & { id: string };

export const HISTORY_LIMIT = 100;
const JOB_ID = /^[a-zA-Z0-9_-]{1,160}$/;
const MAX_IMPORT_CHARS = 5_000_000;
const MAX_IMPORT_JOBS = 500;

export function isHistoryJob(value: unknown): value is HistoryJob {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as { id?: unknown }).id === "string" &&
    JOB_ID.test((value as { id: string }).id)
  );
}

export function historyTimestamp(job: Record<string, unknown>): number | null {
  const raw = job.createdAt ?? job.created_at;
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const time = new Date(raw).getTime();
  return Number.isFinite(time) ? time : null;
}

/** A portable copy of this browser's history. It never contains API keys. */
export function createHistoryExport(
  jobs: readonly Record<string, unknown>[],
  exportedAt = new Date(),
) {
  return {
    app: "higgsfield-studio",
    kind: "history",
    version: 1,
    exportedAt: exportedAt.toISOString(),
    jobs: jobs.filter(isHistoryJob),
  };
}

export function historyFilename(date = new Date()) {
  const day = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  return `higgsfield-studio-povijest-${day}.json`;
}

/** Validates an exported history file (or a raw saved list) before merging. */
export function parseHistoryImport(text: string): HistoryJob[] {
  if (text.length > MAX_IMPORT_CHARS)
    throw new Error("Datoteka je prevelika za uvoz povijesti (najviše 5 MB).");
  let data: unknown;
  try {
    // Drop prototype-polluting keys before any object reaches app state.
    data = JSON.parse(text, (key, value) =>
      key === "__proto__" || key === "constructor" || key === "prototype"
        ? undefined
        : value,
    );
  } catch {
    throw new Error("Datoteka nije valjani JSON izvoz povijesti.");
  }
  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { jobs?: unknown }).jobs)
      ? (data as { jobs: unknown[] }).jobs
      : null;
  if (!list)
    throw new Error("Datoteka ne sadrži povijest kreacija iz ovog studija.");
  const seen = new Set<string>();
  const jobs: HistoryJob[] = [];
  for (const item of list.slice(0, MAX_IMPORT_JOBS)) {
    if (!isHistoryJob(item) || seen.has(item.id)) continue;
    seen.add(item.id);
    jobs.push(item);
  }
  if (!jobs.length)
    throw new Error("U datoteci nema kreacija koje je moguće uvesti.");
  return jobs;
}

/**
 * Adds imported entries that are not already present. Local entries win, the
 * result is newest first, and only the most recent `limit` entries are kept.
 */
export function mergeHistory(
  existing: readonly HistoryJob[],
  imported: readonly HistoryJob[],
  limit = HISTORY_LIMIT,
) {
  const known = new Set(existing.map((job) => job.id));
  const additions = imported.filter((job) => !known.has(job.id));
  const ordered = [...existing, ...additions]
    .map((job, index) => ({ job, index, time: historyTimestamp(job) }))
    .sort((left, right) => {
      if (left.time === null && right.time === null) return left.index - right.index;
      if (left.time === null) return 1;
      if (right.time === null) return -1;
      return right.time - left.time || left.index - right.index;
    })
    .map((entry) => entry.job);
  const jobs = ordered.slice(0, limit);
  const kept = new Set(jobs.map((job) => job.id));
  return {
    jobs,
    added: additions.filter((job) => kept.has(job.id)).length,
    dropped: ordered.length - jobs.length,
  };
}
