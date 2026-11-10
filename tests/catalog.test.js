import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryLabel, functionLabel } from '../src/lib/catalog.ts';

test('catalog operation types get Croatian labels with a readable fallback', () => {
  assert.equal(functionLabel('reference-to-video'), 'Referenca → video');
  assert.equal(functionLabel('text-to-speech'), 'Tekst → govor');
  assert.equal(functionLabel('brand-new_tool'), 'Brand new tool');
  assert.equal(functionLabel(undefined), '');
});

test('catalog categories are localized and capitalized', () => {
  assert.equal(categoryLabel('image'), 'Slike');
  assert.equal(categoryLabel('3d'), '3d');
  assert.equal(categoryLabel('mesh'), 'Mesh');
  assert.equal(categoryLabel(''), 'Ostalo');
});
