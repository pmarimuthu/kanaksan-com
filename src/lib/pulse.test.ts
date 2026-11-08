import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sumBatchGet, fetchSuiteStats, formatCount, statsDocName } from './pulse.ts';

const found = (total: unknown, unique: unknown) => ({
  found: { name: 'x', fields: { total, unique, todayCount: { integerValue: '1' } } },
});

test('sums integerValue strings across apps', () => {
  const r = sumBatchGet([
    found({ integerValue: '120' }, { integerValue: '40' }),
    found({ integerValue: '30' }, { integerValue: '10' }),
  ]);
  assert.deepEqual(r, { total: 150, unique: 50, apps: 2 });
});

test('missing docs are skipped', () => {
  const r = sumBatchGet([found({ integerValue: '5' }, { integerValue: '2' }), { missing: 'projects/x' }]);
  assert.deepEqual(r, { total: 5, unique: 2, apps: 1 });
});

test('bad values count as 0; doubleValue accepted', () => {
  const r = sumBatchGet([found({ doubleValue: 7 }, { stringValue: 'oops' }), found({ integerValue: '-3' }, null)]);
  assert.deepEqual(r, { total: 7, unique: 0, apps: 2 });
});

test('non-array / empty / all-zero → null', () => {
  assert.equal(sumBatchGet({ error: 'denied' }), null);
  assert.equal(sumBatchGet([]), null);
  assert.equal(sumBatchGet([{ missing: 'a' }]), null);
  assert.equal(sumBatchGet([found({ integerValue: '0' }, { integerValue: '0' })]), null);
});

// Real document shape, as returned by GET .../projects/learn.kanaksan.com/stats/global
const learnDoc = {
  name: 'projects/pulse-kanaksan/databases/(default)/documents/projects/learn.kanaksan.com/stats/global',
  fields: {
    todayDate: { stringValue: '2026-11-08' },
    total: { integerValue: '595' },
    todayCount: { integerValue: '4' },
    unique: { integerValue: '89' },
  },
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const quiet = () => {};

test('fetchSuiteStats: sums real-shaped docs, skips 404 and failures', async () => {
  const logs: string[] = [];
  const fake = (async (url: string) => {
    if (url.includes('/learn.kanaksan.com/')) return json(learnDoc);
    if (url.includes('/calendar.kanaksan.com/')) return json({ ...learnDoc, fields: { total: { integerValue: '5' }, unique: { integerValue: '1' } } });
    if (url.includes('/kanaksan.com/stats')) return json({ error: { code: 404 } }, 404);
    throw new Error('net down');
  }) as unknown as typeof fetch;
  const r = await fetchSuiteStats(['kanaksan.com', 'learn.kanaksan.com', 'calendar.kanaksan.com', 'vote.kanaksan.com'], { fetchImpl: fake, log: (m) => logs.push(m) });
  assert.deepEqual(r, { total: 600, unique: 90, apps: 2 });
  assert.ok(logs.some((l) => l.includes('net down')));
});

test('fetchSuiteStats: uses GET on the document URL', async () => {
  let seen = '';
  let method = '';
  const fake = (async (url: string, init?: RequestInit) => { seen = url; method = init?.method ?? 'GET'; return json(learnDoc); }) as unknown as typeof fetch;
  await fetchSuiteStats(['learn.kanaksan.com'], { fetchImpl: fake, log: quiet });
  assert.equal(seen, 'https://firestore.googleapis.com/v1/projects/pulse-kanaksan/databases/(default)/documents/projects/learn.kanaksan.com/stats/global');
  assert.equal(method, 'GET');
});

test('fetchSuiteStats: all failing / timeout / empty → null', async () => {
  const http500 = (async () => new Response('x', { status: 500 })) as typeof fetch;
  const slow = ((_u: unknown, init?: RequestInit) =>
    new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))) as typeof fetch;
  assert.equal(await fetchSuiteStats(['a'], { fetchImpl: http500, log: quiet }), null);
  assert.equal(await fetchSuiteStats(['a'], { fetchImpl: slow, timeoutMs: 50, log: quiet }), null);
  assert.equal(await fetchSuiteStats([], { log: quiet }), null);
});

test('doc name and Indian number format', () => {
  assert.equal(statsDocName('kanaksan.com'), 'projects/pulse-kanaksan/databases/(default)/documents/projects/kanaksan.com/stats/global');
  assert.equal(formatCount(123456), '1,23,456');
});
