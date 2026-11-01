import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './index.js';

const KEY = 'test-private-pika-key';
const API_ID = 'pika/pika-2.5/text-to-video';
const OP = { api_id: API_ID, category: 'video', name: 'Pika 2.5', call: { method: 'POST', path: `/v1/media/${API_ID}` }, input_schema: { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] } };
const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

async function setup(t, override) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, ...init });
    const overridden = await override?.(url, init, calls);
    if (overridden) return overridden;
    const pathname = new URL(url).pathname;
    if (pathname === '/billing/balance') return response({ balance_micro_usd: 10000000, postpaid: null });
    if (pathname === '/catalog/apis') return response({ apis: [OP, { api_id: 'openai/chat', call: { method: 'POST', path: '/v1/chat/completions' } }] });
    if (pathname === `/catalog/apis/${API_ID}`) return response(OP);
    if (pathname.endsWith('/quote')) return response({ sell_usd: '0.20', micro_usd: 200000 });
    if (pathname === `/v1/media/${API_ID}`) return response({ id: 'media_test', status: 'queued' });
    if (pathname === '/v1/media/jobs/media_test') return response({ id: 'media_test', status: 'completed', output: { media_type: 'video', video: { url: 'https://cdn.pika.art/test.mp4' } } });
    throw new Error('Unmocked call');
  };
  const server = createApp({ fetchImpl, serveStatic: false }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let cookie;
  const request = async (url, body, options = {}) => {
    const res = await fetch(origin + url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), Origin: origin },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}), ...options,
    });
    // Match a browser's cookie jar, including the expired cookie on disconnect.
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return { status: res.status, headers: res.headers, data: await res.json() };
  };
  const connect = async () => { const r = await request('/api/connect', { apiKey: KEY }); cookie = r.headers.get('set-cookie')?.split(';')[0]; return r; };
  return { calls, request, connect, origin };
}

const payload = (requestId = 'request-0123456789012345') => ({ apiId: API_ID, input: { prompt: 'A cinematic landscape' }, requestId, maxCostMicroUsd: 200000 });

test('connect validates a real provider key, returns only HttpOnly session token, and disconnect clears it', async t => {
  const { request, connect, calls } = await setup(t);
  const connected = await connect();
  assert.equal(connected.status, 200);
  assert.equal(connected.data.connected, true);
  assert.match(connected.headers.get('set-cookie'), /HttpOnly/);
  assert.match(connected.headers.get('set-cookie'), /SameSite=Lax/);
  assert.ok(!JSON.stringify(connected.data).includes(KEY));
  assert.ok(!connected.headers.get('set-cookie').includes(KEY));
  assert.equal(calls[0].headers['X-API-Key'], KEY);
  assert.equal((await request('/api/session')).data.connected, true);
  assert.equal((await request('/api/session', undefined, { method: 'DELETE' })).data.connected, false);
  assert.equal((await request('/api/session')).data.connected, false);
});

test('invalid key does not create a session and provider errors redact credentials', async t => {
  const { connect } = await setup(t, url => new URL(url).pathname === '/billing/balance' ? response({ message: `Invalid key ${KEY}` }, 401) : null);
  const r = await connect();
  assert.equal(r.status, 401);
  assert.equal(r.headers.get('set-cookie'), null);
  assert.ok(!r.data.message.includes(KEY));
});

test('cross-site state changes and arbitrary catalog paths are rejected', async t => {
  const { request, calls } = await setup(t);
  const crossSite = await request('/api/connect', { apiKey: KEY }, { headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' } });
  assert.equal(crossSite.status, 403);
  assert.equal((await request('/api/catalog/detail?apiId=../../billing/balance')).status, 400);
  assert.equal(calls.length, 0);
});

test('public catalog and quotes are available without a key and filter unsupported protocols', async t => {
  const { request } = await setup(t);
  assert.equal((await request('/api/catalog')).data.apis.length, 1);
  assert.equal((await request('/api/quote', payload())).data.micro_usd, 200000);
  assert.equal((await request('/api/generate', payload())).status, 401);
});

test('generation checks price and balance, forwards exact input, recovers job and rejects changed idempotency body', async t => {
  const { request, connect, calls } = await setup(t);
  await connect();
  const denied = await request('/api/generate', { ...payload(), maxCostMicroUsd: 100000 });
  assert.equal(denied.status, 409);
  assert.equal(calls.filter(x => x.url.endsWith(`/v1/media/${API_ID}`)).length, 0);
  const generation = await request('/api/generate', payload());
  assert.equal(generation.data.status, 'queued');
  const submit = calls.find(x => x.url.endsWith(`/v1/media/${API_ID}`));
  assert.equal(submit.headers['X-API-Key'], KEY);
  assert.equal(submit.headers['Idempotency-Key'], payload().requestId);
  assert.deepEqual(JSON.parse(submit.body), payload().input);
  assert.equal((await request('/api/generate', payload())).data.status, 'completed');
  assert.equal(calls.filter(x => x.url.endsWith(`/v1/media/${API_ID}`)).length, 1);
  assert.equal((await request('/api/generate', { ...payload(), input: { prompt: 'Changed' } })).status, 409);
});

test('insufficient account balance prevents a paid submit', async t => {
  const { request, connect, calls } = await setup(t, url => new URL(url).pathname === '/billing/balance' ? response({ balance_micro_usd: 1 }) : null);
  await connect();
  const generation = await request('/api/generate', payload());
  assert.equal(generation.status, 402);
  assert.equal(generation.data.code, 'insufficient_balance');
  assert.equal(calls.filter(x => x.url.endsWith(`/v1/media/${API_ID}`)).length, 0);
});

test('uncertain submission retries the same idempotency key even when accepted job consumed remaining balance', async t => {
  let submitCount = 0;
  const { request, connect, calls } = await setup(t, (url) => {
    if (url.endsWith(`/v1/media/${API_ID}`) && ++submitCount === 1) throw new Error('network timeout after dispatch');
    if (url.endsWith('/billing/balance') && submitCount) return response({ balance_micro_usd: 0 });
    return null;
  });
  await connect();
  assert.equal((await request('/api/generate', payload())).status, 502);
  assert.equal((await request('/api/generate', payload())).data.status, 'queued');
  const submits = calls.filter(x => x.url.endsWith(`/v1/media/${API_ID}`));
  assert.equal(submits.length, 2);
  assert.equal(submits[0].headers['Idempotency-Key'], submits[1].headers['Idempotency-Key']);
});

test('failed upstream jobs retain recovery ID and actionable error', async t => {
  const { request, connect } = await setup(t, url => url.endsWith(`/v1/media/${API_ID}`) ? response({ id: 'media_test', status: 'failed', error: { code: 'content_moderation', message: 'Prompt could not be processed.' } }, 422) : null);
  await connect();
  const r = await request('/api/generate', payload());
  assert.equal(r.status, 422);
  assert.equal(r.data.code, 'content_moderation');
  assert.equal(r.data.job.id, 'media_test');
});

test('reference upload uses exact signed headers and never forwards the key to storage', async t => {
  const { request, connect, calls, origin } = await setup(t, url => {
    if (url.endsWith('/v1/media/uploads')) return response({ upload_url: 'https://uploads.pika.art/upload?signature=test', url: 'https://cdn.pika.art/reference.png', headers: { 'Content-Type': 'image/png', 'Content-Length': '4' } });
    if (url.startsWith('https://uploads.pika.art/')) return new Response('', { status: 200 });
    return null;
  });
  const connected = await connect();
  const r = await request('/api/uploads', undefined, { method: 'POST', headers: { Origin: origin, Cookie: connected.headers.get('set-cookie').split(';')[0], 'Content-Type': 'image/png' }, body: Buffer.from([1, 2, 3, 4]) });
  assert.equal(r.status, 200);
  assert.equal(r.data.url, 'https://cdn.pika.art/reference.png');
  const mint = calls.find(x => x.url.endsWith('/v1/media/uploads'));
  assert.deepEqual(JSON.parse(mint.body), { content_type: 'image/png', size_bytes: 4 });
  const upload = calls.find(x => x.url.startsWith('https://uploads.pika.art/'));
  assert.deepEqual(upload.headers, { 'Content-Type': 'image/png', 'Content-Length': '4' });
  assert.equal(upload.headers['X-API-Key'], undefined);
});

test('unauthenticated uploads are rejected before parsing the file body', async t => {
  const { request, origin, calls } = await setup(t);
  const r = await request('/api/uploads', undefined, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'image/png' }, body: Buffer.from([1, 2, 3, 4]) });
  assert.equal(r.status, 401);
  assert.equal(r.data.code, 'not_connected');
  assert.equal(calls.length, 0);
});
