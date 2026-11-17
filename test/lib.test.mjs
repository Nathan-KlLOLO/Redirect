import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidProjectKey, isAllowedTarget, resolveProject, timeAgo } from '../lib.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.parse('2026-11-17T16:00:00.000Z');

test('isValidProjectKey accepts lowercase, digits, hyphens', () => {
  for (const k of ['a', '0', 'lan-host-example', 'a1-b2', 'x'.repeat(64)]) {
    assert.equal(isValidProjectKey(k), true, k);
  }
});

test('isValidProjectKey rejects bad keys', () => {
  const bad = [
    '__proto__',
    'constructor',
    'bad!',
    '',
    '-leading',
    'Upper',
    'has space',
    'under_score',
    'dot.dot',
    'x'.repeat(65),
    null,
    undefined,
    42,
    {},
    ['a'],
  ];
  for (const k of bad) assert.equal(isValidProjectKey(k), false, String(k));
});

test('isAllowedTarget accepts private IPv4 http origins and returns the href', () => {
  assert.equal(isAllowedTarget('http://10.0.0.16:8080'), 'http://10.0.0.16:8080/');
  assert.equal(isAllowedTarget('http://192.168.137.1:8080'), 'http://192.168.137.1:8080/');
  assert.equal(isAllowedTarget('http://172.16.0.5:3000'), 'http://172.16.0.5:3000/');
  assert.equal(isAllowedTarget('http://172.31.255.255/'), 'http://172.31.255.255/');
  assert.equal(isAllowedTarget('http://10.0.0.16'), 'http://10.0.0.16/');
  assert.equal(isAllowedTarget('http://192.168.0.1:65535'), 'http://192.168.0.1:65535/');
  // Default port and empty query/hash markers normalise away.
  assert.equal(isAllowedTarget('http://10.0.0.1:80/'), 'http://10.0.0.1/');
  assert.equal(isAllowedTarget('http://10.0.0.1:8080?'), 'http://10.0.0.1:8080/');
});

test('isAllowedTarget rejects everything else', () => {
  const bad = [
    'http://172.32.0.1',
    'http://172.15.0.1',
    'http://8.8.8.8',
    'http://192.169.0.1',
    'http://11.0.0.1',
    'https://10.0.0.1',
    'http://10.0.0.1@evil.com',
    'http://user:pw@10.0.0.1',
    'http://user@10.0.0.1',
    'http://evil.com',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://10.0.0.1.evil.com',
    'http://10.0.0.1:70000',
    'http://10.0.0.1:8080/path',
    'http://10.0.0.1:8080/?x=1',
    'http://10.0.0.1:8080/#frag',
    'http://[::1]:8080',
    'javascript:alert(1)',
    'ftp://10.0.0.1',
    '//10.0.0.1',
    '',
    'not a url',
    null,
    undefined,
    42,
    {},
  ];
  for (const u of bad) assert.equal(isAllowedTarget(u), null, String(u));
});

test('isAllowedTarget handles URL-normalised IPv4 forms', () => {
  // The URL parser turns these into dotted quads; only private results pass.
  assert.equal(isAllowedTarget('http://0xa.0.0.1'), 'http://10.0.0.1/');
  assert.equal(isAllowedTarget('http://134744072'), null); // 8.8.8.8 as integer
});

function targetsWith(entry) {
  return { version: 1, projects: { demo: entry } };
}

test('resolveProject: bad-key', () => {
  const t = targetsWith({ url: 'http://10.0.0.16:8080', updated: new Date(NOW).toISOString() });
  for (const k of ['__proto__', 'BAD!', '', null, undefined, 5]) {
    assert.deepEqual(resolveProject(t, k, NOW), { status: 'bad-key' }, String(k));
  }
});

test('resolveProject: no-project when the key is not an own property', () => {
  const t = targetsWith({ url: 'http://10.0.0.16:8080', updated: new Date(NOW).toISOString() });
  assert.deepEqual(resolveProject(t, 'nope', NOW), { status: 'no-project' });
  // Inherited names are rejected as keys before lookup.
  assert.deepEqual(resolveProject(t, 'constructor', NOW), { status: 'bad-key' });
  assert.deepEqual(resolveProject(t, '__proto__', NOW), { status: 'bad-key' });
});

test('resolveProject: malformed targets never throw and give no-project', () => {
  const bad = [
    null,
    undefined,
    42,
    'str',
    [],
    {},
    { version: 2, projects: { demo: { url: 'http://10.0.0.16:8080', updated: new Date(NOW).toISOString() } } },
    { version: 1 },
    { version: 1, projects: null },
    { version: 1, projects: [] },
    { version: 1, projects: 'x' },
  ];
  for (const t of bad) {
    assert.deepEqual(resolveProject(t, 'demo', NOW), { status: 'no-project' }, JSON.stringify(t));
  }
});

test('resolveProject: bad-target for malformed or disallowed entries', () => {
  const now = new Date(NOW).toISOString();
  const bad = [
    null,
    'http://10.0.0.16:8080',
    [],
    {},
    { updated: now },
    { url: 42, updated: now },
    { url: 'https://10.0.0.16:8080', updated: now },
    { url: 'http://8.8.8.8', updated: now },
    { url: 'http://10.0.0.1@evil.com', updated: now },
    { url: 'http://10.0.0.16:8080/path', updated: now },
  ];
  for (const e of bad) {
    assert.deepEqual(resolveProject(targetsWith(e), 'demo', NOW), { status: 'bad-target' }, JSON.stringify(e));
  }
});

test('resolveProject: redirect for a fresh entry, with normalised url', () => {
  const r = resolveProject(targetsWith({ url: 'http://10.0.0.16:8080', updated: new Date(NOW - HOUR).toISOString() }), 'demo', NOW);
  assert.deepEqual(r, { status: 'redirect', url: 'http://10.0.0.16:8080/' });
});

test('resolveProject: 24 h boundary (exactly 24 h is still fresh, 1 ms more is stale)', () => {
  const at = (ageMs) => targetsWith({ url: 'http://10.0.0.16:8080', updated: new Date(NOW - ageMs).toISOString() });
  assert.equal(resolveProject(at(DAY), 'demo', NOW).status, 'redirect');
  const stale = resolveProject(at(DAY + 1), 'demo', NOW);
  assert.equal(stale.status, 'stale');
  assert.equal(stale.url, 'http://10.0.0.16:8080/');
  assert.equal(stale.updated, NOW - DAY - 1);
});

test('resolveProject: custom maxAgeMs', () => {
  const t = targetsWith({ url: 'http://10.0.0.16:8080', updated: new Date(NOW - 2 * HOUR).toISOString() });
  assert.equal(resolveProject(t, 'demo', NOW, HOUR).status, 'stale');
  assert.equal(resolveProject(t, 'demo', NOW, 3 * HOUR).status, 'redirect');
});

test('resolveProject: missing or unparseable updated is stale with updated null', () => {
  for (const updated of [undefined, 'yesterday', '', 12345, null]) {
    const r = resolveProject(targetsWith({ url: 'http://10.0.0.16:8080', updated }), 'demo', NOW);
    assert.deepEqual(r, { status: 'stale', url: 'http://10.0.0.16:8080/', updated: null }, String(updated));
  }
});

test('timeAgo', () => {
  assert.equal(timeAgo(0), 'just now');
  assert.equal(timeAgo(30 * 1000), 'just now');
  assert.equal(timeAgo(-5000), 'just now');
  assert.equal(timeAgo(60 * 1000), '1 minute ago');
  assert.equal(timeAgo(5 * 60 * 1000), '5 minutes ago');
  assert.equal(timeAgo(HOUR), '1 hour ago');
  assert.equal(timeAgo(3 * HOUR + 59 * 60 * 1000), '3 hours ago');
  assert.equal(timeAgo(DAY), '1 day ago');
  assert.equal(timeAgo(2 * DAY + 5 * HOUR), '2 days ago');
});
