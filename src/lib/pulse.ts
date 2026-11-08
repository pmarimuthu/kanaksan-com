/**
 * Visitor counts from pulse (Firestore, project `pulse-kanaksan`).
 *
 * Each app's counters live at projects/{appId}/stats/global  →  { total, unique, ... }.
 * Firestore rules allow public read, so we read them with plain REST GETs on the SERVER:
 * no Firebase SDK and no extra JavaScript in the visitor's browser.
 *
 * "unique" across apps is a sum of each app's unique visitors (a person who visits
 * two apps is counted in both), so it is an approximate suite-wide figure.
 */

export const PULSE_PROJECT = 'pulse-kanaksan';

export type SuiteStats = { total: number; unique: number; apps: number };

const DB = `projects/${PULSE_PROJECT}/databases/(default)/documents`;

export const statsDocName = (appId: string) => `${DB}/projects/${appId}/stats/global`;

/** Firestore REST number field → number (integerValue comes as a string). */
const num = (field: unknown): number => {
  if (!field || typeof field !== 'object') return 0;
  const f = field as Record<string, unknown>;
  const raw = f.integerValue ?? f.doubleValue;
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/** Sum items shaped like { found: <Firestore REST document> } | { missing }. Returns null if nothing usable. */
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

const docUrl = (appId: string) =>
  `https://firestore.googleapis.com/v1/${statsDocName(appId)}`;

/**
 * Fetch and sum counters for the given app IDs: one simple GET per app, all in parallel
 * (the same request that works in a browser). Never throws; returns null if nothing usable.
 * Failures are logged so they show up in Vercel's Runtime Logs.
 */
export async function fetchSuiteStats(
  appIds: string[],
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch; log?: (msg: string) => void } = {},
): Promise<SuiteStats | null> {
  const { timeoutMs = 3000, fetchImpl = fetch, log = (m) => console.warn(m) } = opts;
  if (appIds.length === 0) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const results = await Promise.allSettled(
      appIds.map(async (id) => {
        const res = await fetchImpl(docUrl(id), { signal: ctrl.signal, headers: { Accept: 'application/json' } });
        if (res.status === 404) return { missing: id };
        if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`);
        return { found: await res.json() };
      }),
    );
    const items = results.flatMap((r) => {
      if (r.status === 'fulfilled') return [r.value];
      log(`[pulse] ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
      return [];
    });
    const sum = sumBatchGet(items);
    if (!sum) log(`[pulse] no usable stats for: ${appIds.join(', ')}`);
    return sum;
  } catch (e) {
    log(`[pulse] failed: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 123456 → "1,23,456" (Indian grouping). */
export const formatCount = (n: number) => new Intl.NumberFormat('en-IN').format(n);
