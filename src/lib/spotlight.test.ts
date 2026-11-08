import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSpotlight } from './spotlight.ts';

const now = new Date('2026-11-08T12:00:00+05:30');
const good = {
  type: 'image',
  src: 'https://example.com/a.jpg',
  alt: 'Happy Diwali from Kanaksan',
  caption: 'Happy Diwali!',
  startAt: '2026-11-08T00:00:00+05:30',
  endAt: '2026-11-10T23:59:59+05:30',
};

test('valid object gives content', () => {
  const r = resolveSpotlight(good, now);
  assert.equal(r.kind, 'content');
});

test('valid JSON string gives content', () => {
  assert.equal(resolveSpotlight(JSON.stringify(good), now).kind, 'content');
});

const fallbacks: Array<[string, unknown]> = [
  ['undefined', undefined],
  ['null', null],
  ['empty string', ''],
  ['bad JSON', '{oops'],
  ['array', []],
  ['type none', { ...good, type: 'none' }],
  ['unknown type', { ...good, type: 'video' }],
  ['http src', { ...good, src: 'http://example.com/a.jpg' }],
  ['missing src', { ...good, src: '' }],
  ['missing alt', { ...good, alt: '' }],
  ['not started', { ...good, startAt: '2026-11-09T00:00:00+05:30' }],
  ['expired', { ...good, endAt: '2026-11-08T00:00:00+05:30' }],
];

for (const [name, input] of fallbacks) {
  test(`fallback: ${name}`, () => {
    assert.equal(resolveSpotlight(input, now).kind, 'fallback');
  });
}

test('bad optional link is dropped, content still shown', () => {
  const r = resolveSpotlight({ ...good, link: 'javascript:alert(1)' }, now);
  assert.equal(r.kind, 'content');
  assert.equal(r.kind === 'content' && r.link, undefined);
});
