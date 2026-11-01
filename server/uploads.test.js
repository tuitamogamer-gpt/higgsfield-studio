import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './index.js';

const KEY = 'upload-contract-private-key';
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });

async function setup(t, uploadOverrides = {}) {
  const calls = [];
  const app = createApp({ serveStatic: false, fetchImpl: async (url, init) => {
    calls.push({ url, ...init });
    if (url.endsWith('/billing/balance')) return json({ balance_micro_usd: 1000000 });
    if (url.endsWith('/v1/media/uploads')) {
      const { content_type, size_bytes } = JSON.parse(init.body);
      return json({ upload_url: 'https://uploads.pika.art/reference?signature=temporary', url: 'https://cdn.pika.art/reference.png', method: 'PUT', headers: { 'Content-Type': content_type, 'Content-Length': String(size_bytes) }, max_bytes: 50 * 1024 * 1024, ...uploadOverrides });
    }
    throw new Error('Unexpected outbound request');
  } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let cookie;
  const request = async (path, body) => {
    const response = await fetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, headers: response.headers, body: await response.json() };
  };
  return { calls, request, connect: async () => {
    const response = await request('/api/connect', { apiKey: KEY });
    cookie = response.headers.get('set-cookie')?.split(';')[0];
  } };
}

test('prepare upload returns a signed storage destination without sending file bytes through the API', async t => {
  const { request, connect, calls } = await setup(t);
  await connect();
  const result = await request('/api/uploads/prepare', { contentType: 'video/mp4', sizeBytes: 50 * 1024 * 1024 });
  assert.equal(result.status, 200);
  assert.equal(result.body.uploadUrl, 'https://uploads.pika.art/reference?signature=temporary');
  assert.deepEqual(result.body.headers, { 'Content-Type': 'video/mp4', 'Content-Length': String(50 * 1024 * 1024) });
  assert.ok(!JSON.stringify(result.body).includes(KEY));
  assert.equal(calls.length, 2);
  assert.equal(calls[1].headers['X-API-Key'], KEY);
  assert.deepEqual(JSON.parse(calls[1].body), { content_type: 'video/mp4', size_bytes: 50 * 1024 * 1024 });
  assert.equal(calls.filter(call => call.method === 'PUT').length, 0);
});

test('prepare upload rejects unauthenticated, empty, unsupported, and oversized files before asking Pika', async t => {
  const { request, connect, calls } = await setup(t);
  assert.equal((await request('/api/uploads/prepare', { contentType: 'image/png', sizeBytes: 4 })).status, 401);
  assert.equal(calls.length, 0);
  await connect();
  for (const [contentType, sizeBytes, status] of [
    ['image/png', 0, 400], ['image/png', 1.5, 400], ['image/png', '4', 400],
    ['text/html', 4, 415], ['image/png', 20 * 1024 * 1024 + 1, 413],
    ['video/mp4', 50 * 1024 * 1024 + 1, 413],
  ]) assert.equal((await request('/api/uploads/prepare', { contentType, sizeBytes })).status, status);
  assert.equal(calls.length, 1);
});

test('prepare upload rejects unsafe destinations and credential headers instead of returning them to the browser', async t => {
  for (const overrides of [
    { upload_url: 'https://evil.example/upload' },
    { upload_url: 'https://uploads.pika.art.evil.example/upload' },
    { upload_url: 'http://uploads.pika.art/upload' },
    { upload_url: 'https://user:pass@uploads.pika.art/upload' },
    { url: 'javascript:alert(1)' },
    { method: 'POST' },
    { headers: { 'Content-Type': 'image/png', 'Content-Length': '4', Authorization: 'unsafe' } },
    { headers: { 'Content-Type': 'image/png', 'Content-Length': '5' } },
    { headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '4' } },
    { headers: { 'Content-Type': 'image/png', 'Content-Length': '4', 'x-amz-meta-test': 'unsafe\r\nheader' } },
  ]) {
    const { request, connect } = await setup(t, overrides);
    await connect();
    const result = await request('/api/uploads/prepare', { contentType: 'image/png', sizeBytes: 4 });
    assert.equal(result.status, 502);
    assert.equal(result.body.uploadUrl, undefined);
    assert.ok(!JSON.stringify(result.body).includes(KEY));
  }
});
