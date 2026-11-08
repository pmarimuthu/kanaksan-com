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
  srcset?: string;
  srcsetAvif?: string;
  sizes: string;
  width: number;
  height: number;
  alt: string;
  caption?: string;
  link?: string;
};

export type SpotlightFallback = { kind: 'fallback'; reason: string };

export type Spotlight = SpotlightContent | SpotlightFallback;

/**
 * `sizes` hint matching the CSS: the image fills the width on tall/narrow screens
 * and fits the height on wide/short screens (see Spotlight.astro).
 */
export function spotlightSizes(width: number, height: number): string {
  const ar = (width / height).toFixed(4);
  return `(max-aspect-ratio: ${width}/${height}) calc(100vw - 32px), calc((100vh - 112px) * ${ar})`;
}

/** https URL, or a site-relative path like /spotlight/x.webp (not protocol-relative //). */
const isImageUrl = (v: unknown): v is string => {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  if (s === '') return false;
  if (s.startsWith('/') && !s.startsWith('//')) return !/[\s"'<>]/.test(s);
  try {
    return new URL(s).protocol === 'https:';
  } catch {
    return false;
  }
};

const isHttpsUrl = (v: unknown): v is string => {
  if (typeof v !== 'string' || v.trim() === '') return false;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
};

/** srcset like "/a-480.webp 480w, /a-960.webp 960w"; every candidate URL must be valid. */
const validSrcset = (v: unknown): string | undefined => {
  if (typeof v !== 'string' || v.trim() === '') return undefined;
  const parts = v.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;
  for (const p of parts) {
    const [url, descriptor, extra] = p.split(/\s+/);
    if (extra !== undefined || !isImageUrl(url)) return undefined;
    if (descriptor !== undefined && !/^\d+(\.\d+)?[wx]$/.test(descriptor)) return undefined;
  }
  return parts.join(', ');
};

const optText = (v: unknown, max = 200): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v.trim().slice(0, max) : undefined;

const posInt = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 10000 ? v : undefined;

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
  if (!isImageUrl(d.src)) return { kind: 'fallback', reason: 'invalid-src' };

  const alt = optText(d.alt, 200);
  if (!alt) return { kind: 'fallback', reason: 'missing-alt' };

  const start = typeof d.startAt === 'string' && d.startAt ? Date.parse(d.startAt) : NaN;
  const end = typeof d.endAt === 'string' && d.endAt ? Date.parse(d.endAt) : NaN;
  if (!Number.isNaN(start) && now.getTime() < start) return { kind: 'fallback', reason: 'not-started' };
  if (!Number.isNaN(end) && now.getTime() > end) return { kind: 'fallback', reason: 'expired' };

  return {
    kind: 'content',
    src: d.src.trim(),
    srcset: validSrcset(d.srcset),
    srcsetAvif: validSrcset(d.srcsetAvif),
    width: posInt(d.width) ?? 1600,
    height: posInt(d.height) ?? 900,
    sizes: optText(d.sizes, 200) ?? spotlightSizes(posInt(d.width) ?? 1600, posInt(d.height) ?? 900),
    alt,
    caption: optText(d.caption, 120),
    link: isHttpsUrl(d.link) ? d.link : undefined,
  };
}
