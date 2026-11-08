/**
 * Spotlight resolver.
 *
 * Takes the raw `hub_spotlight` value (from Firebase Remote Config in Phase 2,
 * or a local file in Phase 1) and returns either valid content or the fallback.
 * It never throws: any bad input means fallback. This runs on the server only,
 * so the browser always receives the final state (no flicker, no loading swap).
 */

export type SpotlightContent = {
  kind: 'content';
  src: string;
  srcMobile?: string;
  alt: string;
  caption?: string;
  link?: string;
};

export type SpotlightFallback = { kind: 'fallback'; reason: string };

export type Spotlight = SpotlightContent | SpotlightFallback;

const isHttpsUrl = (v: unknown): v is string => {
  if (typeof v !== 'string' || v.trim() === '') return false;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
};

const optText = (v: unknown, max = 200): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v.trim().slice(0, max) : undefined;

export function resolveSpotlight(raw: unknown, now: Date = new Date()): Spotlight {
  let data: unknown = raw;

  if (typeof raw === 'string') {
    if (raw.trim() === '') return { kind: 'fallback', reason: 'empty' };
    try {
      data = JSON.parse(raw);
    } catch {
      return { kind: 'fallback', reason: 'invalid-json' };
    }
  }

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { kind: 'fallback', reason: 'missing' };
  }

  const d = data as Record<string, unknown>;

  if (d.type === 'none') return { kind: 'fallback', reason: 'disabled' };
  if (d.type !== 'image') return { kind: 'fallback', reason: 'unsupported-type' };
  if (!isHttpsUrl(d.src)) return { kind: 'fallback', reason: 'invalid-src' };

  const alt = optText(d.alt, 160);
  if (!alt) return { kind: 'fallback', reason: 'missing-alt' };

  const start = typeof d.startAt === 'string' && d.startAt ? Date.parse(d.startAt) : NaN;
  const end = typeof d.endAt === 'string' && d.endAt ? Date.parse(d.endAt) : NaN;
  if (!Number.isNaN(start) && now.getTime() < start) return { kind: 'fallback', reason: 'not-started' };
  if (!Number.isNaN(end) && now.getTime() > end) return { kind: 'fallback', reason: 'expired' };

  return {
    kind: 'content',
    src: d.src,
    srcMobile: isHttpsUrl(d.srcMobile) ? d.srcMobile : undefined,
    alt,
    caption: optText(d.caption, 120),
    link: isHttpsUrl(d.link) ? d.link : undefined,
  };
}
