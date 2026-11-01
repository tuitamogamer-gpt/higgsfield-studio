import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionCodec, SESSION_TTL } from './session.js';
import { createApp } from './index.js';

const SECRET = '01'.repeat(32);
const KEY = 'pika-test-serverless-private-key';

test('encrypted sessions survive independent instances with a shared secret', () => {
  const first = createSessionCodec({ secret: SECRET, production: true, now: () => 1000 });
  const second = createSessionCodec({ secret: SECRET, production: true, now: () => 2000 });
  const { session, token } = first.create(KEY);
  assert.deepEqual(second.open(token), session);
  assert.equal(token.includes(KEY), false);
  assert.equal(Buffer.from(token, 'base64url').includes(Buffer.from(KEY)), false);
  assert.ok(token.length < 3000);
  assert.notEqual(first.create(KEY).token, token);
});

test('tampered, expired and wrong-secret sessions fail closed', () => {
  let clock = 1000;
  const codec = createSessionCodec({ secret: SECRET, now: () => clock });
  const { token } = codec.create(KEY);
  const bytes = Buffer.from(token, 'base64url');
  bytes[30] ^= 1;
  assert.equal(codec.open(bytes.toString('base64url')), undefined);
  assert.equal(codec.open('malformed'), undefined);
  assert.equal(codec.open(token + '='), undefined);
  assert.equal(createSessionCodec({ secret: '02'.repeat(32) }).open(token), undefined);
  clock += SESSION_TTL;
  assert.equal(codec.open(token), undefined);
});

test('production requires a strong, explicitly configured encryption secret', () => {
  assert.throws(() => createSessionCodec({ secret: '', production: true }), /required in production/);
  assert.throws(() => createSessionCodec({ secret: 'short', production: true }), /64 hexadecimal/);
  // Explicit null prevents the env default while testing missing configuration.
  assert.throws(() => createSessionCodec({ secret: null, production: true }), /required in production/);
  assert.doesNotThrow(() => createSessionCodec({ secret: SECRET, production: true }));
});

test('HTTP session stays connected after a fresh app instance and uses secure cookies over HTTPS', async t => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    assert.equal(url, 'https://api.dev.pika.art/billing/balance');
    return new Response(JSON.stringify({ balance_micro_usd: 1000000 }), { headers: { 'Content-Type': 'application/json' } });
  };
  const first = createApp({ fetchImpl, sessionSecret: SECRET, serveStatic: false }).listen(0, '127.0.0.1');
  const second = createApp({ fetchImpl, sessionSecret: SECRET, serveStatic: false }).listen(0, '127.0.0.1');
  await Promise.all([first, second].map(server => new Promise(resolve => server.once('listening', resolve))));
  t.after(() => Promise.all([first, second].map(server => new Promise(resolve => server.close(resolve)))));
  const connect = await fetch(`http://127.0.0.1:${first.address().port}/api/connect`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https' }, body: JSON.stringify({ apiKey: KEY }),
  });
  assert.equal(connect.status, 200);
  const header = connect.headers.get('set-cookie');
  assert.match(header, /HttpOnly/);
  assert.match(header, /Secure/);
  assert.match(header, /SameSite=Lax/);
  const session = await fetch(`http://127.0.0.1:${second.address().port}/api/session`, { headers: { Cookie: header.split(';')[0] } });
  assert.deepEqual(await session.json(), { connected: true, balance: { balance_micro_usd: 1000000 } });
  assert.equal(calls[1].options.headers['X-API-Key'], KEY);
  const disconnect = await fetch(`http://127.0.0.1:${second.address().port}/api/session`, { method: 'DELETE', headers: { Cookie: header.split(';')[0] } });
  assert.match(disconnect.headers.get('set-cookie'), /^frame_session=;/);
  assert.match(disconnect.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
});
