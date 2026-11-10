import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareReferenceFile, referenceLimitMb, referenceRules } from '../src/lib/reference.ts';

const file = (name, type, size = 4) => new File([new Uint8Array(size)], name, { type });

test('referenceRules describes accepted formats for a field', () => {
  const image = referenceRules('image/*');
  assert.equal(image.kind, 'image');
  assert.equal(image.formats, 'PNG, JPG, WEBP, GIF');
  assert.equal(image.limitLabel, 'Do 20 MB');
  assert.equal(referenceRules('video/*').limitLabel, 'Do 50 MB');
  assert.equal(referenceRules('*/*').kind, 'file');
});

test('prepareReferenceFile infers missing types from the extension', () => {
  const result = prepareReferenceFile(file('frame.JPG', ''), 'image/*');
  assert.equal(result.error, undefined);
  assert.equal(result.file.type, 'image/jpeg');
  assert.equal(result.file.name, 'frame.JPG');
  const alias = prepareReferenceFile(file('song.m4a', 'audio/x-m4a'), 'audio/*');
  assert.equal(alias.file.type, 'audio/mp4');
});

test('prepareReferenceFile rejects wrong, empty, unsupported, and oversized files', () => {
  assert.match(prepareReferenceFile(file('clip.mp4', 'video/mp4'), 'image/*').error, /odaberi sliku/);
  assert.match(prepareReferenceFile(file('empty.png', 'image/png', 0), 'image/*').error, /prazna/);
  assert.match(prepareReferenceFile(file('doc.pdf', 'application/pdf'), '*/*').error, /nije podržan/);
  const big = { name: 'big.png', type: 'image/png', size: 21 * 1024 * 1024, lastModified: 0 };
  assert.match(prepareReferenceFile(big, 'image/*').error, /20 MB/);
  assert.equal(referenceLimitMb('video/mp4'), 50);
  assert.equal(referenceLimitMb('image/png'), 20);
});
