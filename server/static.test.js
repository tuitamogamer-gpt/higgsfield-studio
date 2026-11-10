import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp, SECURITY_HEADERS } from './index.js';

async function serve(t) {
  const dist = mkdtempSync(path.join(tmpdir(), 'studio-dist-'));
  mkdirSync(path.join(dist, 'assets'));
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><div id="root"></div>');
  writeFileSync(path.join(dist, 'assets', 'index-abc123.js'), 'console.log(1)');
  writeFileSync(path.join(dist, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const server = createApp({ fetchImpl: async () => { throw new Error('offline'); }, distDir: dist }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(() => { rmSync(dist, { recursive: true, force: true }); resolve(); })));
  return `http://127.0.0.1:${server.address().port}`;
}

test('production static files use long caching only for fingerprinted assets', async t => {
  const origin = await serve(t);
  const asset = await fetch(`${origin}/assets/index-abc123.js`);
  assert.equal(asset.status, 200);
  assert.equal(asset.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  const missing = await fetch(`${origin}/assets/old-chunk.js`);
  assert.equal(missing.status, 404);
  assert.doesNotMatch(await missing.text(), /id="root"/);
  for (const route of ['/', '/index.html', '/studio']) {
    const page = await fetch(origin + route);
    assert.equal(page.status, 200, route);
    assert.equal(page.headers.get('cache-control'), 'no-cache', route);
    assert.match(await page.text(), /id="root"/);
    assert.equal(page.headers.get('content-security-policy'), SECURITY_HEADERS['Content-Security-Policy']);
  }
  const icon = await fetch(`${origin}/favicon.svg`);
  assert.equal(icon.headers.get('cache-control'), 'public, max-age=86400');
});

test('Vercel serves the same security headers as the Node server', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const global = config.headers.find(rule => rule.source === '/(.*)');
  assert.deepEqual(Object.fromEntries(global.headers.map(({ key, value }) => [key, value])), SECURITY_HEADERS);
  const assets = config.headers.find(rule => rule.source === '/assets/(.*)');
  assert.equal(assets.headers[0].value, 'public, max-age=31536000, immutable');
  assert.ok(!config.rewrites.some(rule => rule.destination === '/index.html' && 'assets/x.js'.match(new RegExp(`^${rule.source.slice(1)}$`))));
});
