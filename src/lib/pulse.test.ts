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

test('fetchSuiteStats: ok response', async () => {
  const fake = (async () => new Response(JSON.stringify([found({ integerValue: '9' }, { integerValue: '4' })]), { status: 200 })) as typeof fetch;
  assert.deepEqual(await fetchSuiteStats(['a'], { fetchImpl: fake }), { total: 9, unique: 4, apps: 1 });
});

test('fetchSuiteStats: HTTP error / network error / timeout → null', async () => {
  const http500 = (async () => new Response('x', { status: 500 })) as typeof fetch;
  const boom = (async () => { throw new Error('net'); }) as typeof fetch;
  const slow = ((_u: unknown, init?: RequestInit) =>
    new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))) as typeof fetch;
  assert.equal(await fetchSuiteStats(['a'], { fetchImpl: http500 }), null);
  assert.equal(await fetchSuiteStats(['a'], { fetchImpl: boom }), null);
  assert.equal(await fetchSuiteStats(['a'], { fetchImpl: slow, timeoutMs: 50 }), null);
  assert.equal(await fetchSuiteStats([]), null);
});

test('doc name and Indian number format', () => {
  assert.equal(statsDocName('kanaksan.com'), 'projects/pulse-kanaksan/databases/(default)/documents/projects/kanaksan.com/stats/global');
  assert.equal(formatCount(123456), '1,23,456');
});
