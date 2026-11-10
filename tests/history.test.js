import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistoryExport, historyFilename, mergeHistory, parseHistoryImport } from '../src/lib/history.ts';

const job = (id, createdAt, extra = {}) => ({ id, status: 'completed', createdAt, ...extra });

test('history export round-trips through import', () => {
  const jobs = [job('media_b', '2026-11-02T10:00:00Z', { prompt: 'B' }), job('media_a', '2026-11-01T10:00:00Z')];
  const file = createHistoryExport(jobs, new Date('2026-11-10T12:00:00Z'));
  assert.equal(file.app, 'higgsfield-studio');
  assert.equal(file.version, 1);
  assert.equal(file.exportedAt, '2026-11-10T12:00:00.000Z');
  assert.deepEqual(parseHistoryImport(JSON.stringify(file)), jobs);
});

test('import accepts a raw saved list, skips invalid and duplicate entries', () => {
  const text = JSON.stringify([job('media_a', '2026-11-01'), job('media_a', '2026-11-02'), { id: '../bad' }, { status: 'completed' }, 'x', null]);
  assert.deepEqual(parseHistoryImport(text).map(item => item.id), ['media_a']);
});

test('import strips prototype keys and rejects unusable files', () => {
  const [parsed] = parseHistoryImport('[{"id":"media_a","__proto__":{"polluted":true},"input":{"constructor":1,"prompt":"x"}}]');
  assert.equal(Object.hasOwn(parsed, '__proto__'), false);
  assert.equal({}.polluted, undefined);
  assert.deepEqual(parsed.input, { prompt: 'x' });
  assert.throws(() => parseHistoryImport('not json'), /JSON/);
  assert.throws(() => parseHistoryImport('{"hello":1}'), /ne sadrži povijest/);
  assert.throws(() => parseHistoryImport('[{"id":"../bad"}]'), /nema kreacija/);
  assert.throws(() => parseHistoryImport(' '.repeat(5_000_001)), /prevelika/);
});

test('merge keeps local entries, orders newest first, and enforces the limit', () => {
  const existing = [job('media_new', '2026-11-05T00:00:00Z', { status: 'running' }), job('media_old', '2026-11-01T00:00:00Z')];
  const imported = [job('media_new', '2026-11-05T00:00:00Z', { status: 'completed' }), job('media_mid', '2026-11-03T00:00:00Z'), job('media_undated', undefined)];
  const merged = mergeHistory(existing, imported);
  assert.deepEqual(merged.jobs.map(item => item.id), ['media_new', 'media_mid', 'media_old', 'media_undated']);
  assert.equal(merged.jobs[0].status, 'running');
  assert.equal(merged.added, 2);
  assert.equal(merged.dropped, 0);
  const limited = mergeHistory(existing, imported, 2);
  assert.deepEqual(limited.jobs.map(item => item.id), ['media_new', 'media_mid']);
  assert.equal(limited.added, 1);
  assert.equal(limited.dropped, 2);
});

test('history filenames use the local calendar date', () => {
  assert.equal(historyFilename(new Date(2026, 0, 5, 12)), 'higgsfield-studio-povijest-2026-01-05.json');
});
