/**
 * Visitor counts from pulse (Firestore, project `pulse-kanaksan`).
 *
 * Each app's counters live at projects/{appId}/stats/global  →  { total, unique, ... }.
 * Firestore rules allow public read, so we use one REST batchGet call on the SERVER:
 * no Firebase SDK and no extra JavaScript in the visitor's browser.
 *
 * "unique" across apps is a sum of each app's unique visitors (a person who visits
 * two apps is counted in both), so it is an approximate suite-wide figure.
 */

export const PULSE_PROJECT = 'pulse-kanaksan';

export type SuiteStats = { total: number; unique: number; apps: number };

const DB = `projects/${PULSE_PROJECT}/databases/(default)/documents`;
const BATCH_GET_URL = `https://firestore.googleapis.com/v1/${DB}:batchGet`;

export const statsDocName = (appId: string) => `${DB}/projects/${appId}/stats/global`;

/** Firestore REST number field → number (integerValue comes as a string). */
const num = (field: unknown): number => {
  if (!field || typeof field !== 'object') return 0;
  const f = field as Record<string, unknown>;
  const raw = f.integerValue ?? f.doubleValue;
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/** Sum a Firestore `documents:batchGet` response. Returns null if nothing usable. */
export function sumBatchGet(body: unknown): SuiteStats | null {
  if (!Array.isArray(body)) return null;
  let total = 0;
  let unique = 0;
  let apps = 0;
  for (const item of body) {
    const found = item && typeof item === 'object' ? (item as Record<string, any>).found : undefined;
    const fields = found?.fields;
    if (!fields) continue;
    total += num(fields.total);
    unique += num(fields.unique);
    apps += 1;
  }
  return apps > 0 && total > 0 ? { total, unique, apps } : null;
}

/** Fetch and sum counters for the given app IDs. Never throws; returns null on any problem. */
export async function fetchSuiteStats(
  appIds: string[],
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<SuiteStats | null> {
  const { timeoutMs = 1500, fetchImpl = fetch } = opts;
  if (appIds.length === 0) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(BATCH_GET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documents: appIds.map(statsDocName) }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return sumBatchGet(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 123456 → "1,23,456" (Indian grouping). */
export const formatCount = (n: number) => new Intl.NumberFormat('en-IN').format(n);
