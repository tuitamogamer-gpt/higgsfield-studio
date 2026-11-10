import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { fetch as proxyFetch, EnvHttpProxyAgent } from 'undici';
import { createSessionCodec, SESSION_TTL } from './session.js';

const API_ORIGIN = 'https://api.dev.pika.art';
const COOKIE = 'frame_session';
const API_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]*(?:\/[a-zA-Z0-9][a-zA-Z0-9._-]*){2}$/;
const JOB_ID = /^[a-zA-Z0-9_-]{1,160}$/;
const MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/webm']);
// Text/LLM operations return different contracts than the studio's media jobs.
const NON_MEDIA_CATEGORIES = new Set(['llm', 'decision']);
// Keep in sync with vercel.json; a test compares both.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self'",
  // Direct reference uploads go to the same storage hosts the server accepts.
  "connect-src 'self' https://*.pika.art https://*.amazonaws.com https://*.r2.cloudflarestorage.com https://storage.googleapis.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');
export const SECURITY_HEADERS = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};
const proxyAgent = process.env.HTTPS_PROXY || process.env.https_proxy ? new EnvHttpProxyAgent() : undefined;
const networkFetch = (url, options) => proxyFetch(url, { ...options, ...(proxyAgent ? { dispatcher: proxyAgent } : {}) });

class ApiError extends Error {
  constructor(status, message, code, job) { super(message); this.status = status; this.code = code; this.job = job; }
}

// Provider errors are shown in the Croatian UI; keep useful validation detail.
function providerDetail(data) {
  for (const value of [data.error?.message, data.message, data.detail]) {
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 500);
  }
  if (Array.isArray(data.detail)) {
    const parts = data.detail.slice(0, 3).map(item => typeof item?.msg !== 'string' ? null
      : `${Array.isArray(item.loc) ? `${item.loc.filter(part => part !== 'body').join('.')}: ` : ''}${item.msg}`).filter(Boolean);
    if (parts.length) return parts.join('; ').slice(0, 500);
  }
  return '';
}
export function upstreamMessage(status, data = {}) {
  if (status === 401 || status === 403) return 'Pika nije prihvatio ovaj API ključ ili ključ nema pristup ovoj radnji.';
  if (status === 402) return 'Stanje Pika računa nije dovoljno za ovaj zahtjev. Nadoplati sredstva na Pika računu.';
  if (status === 404) return 'Pika nije pronašao traženi zahtjev ili model.';
  if (status === 429) return 'Pika trenutačno prima previše zahtjeva. Pričekaj trenutak i pokušaj ponovno.';
  if (status >= 500) return 'Pika trenutačno ne može obraditi zahtjev. Pokušaj ponovno malo kasnije.';
  const detail = providerDetail(data);
  return detail ? `Pika je odbio zahtjev: ${detail}` : `Pika je odbio zahtjev (${status}). Provjeri postavke i pokušaj ponovno.`;
}

export function createApp({ fetchImpl = networkFetch, now = Date.now, serveStatic = true, sessionSecret, distDir } = {}) {
  const app = express();
  const sessionCodec = createSessionCodec({ secret: sessionSecret, now });
  // A bounded optimization for idempotency on a warm instance, not an auth store.
  const sessions = new Map();
  const rates = new Map();
  let catalogCache;
  const details = new Map();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((req, res, next) => {
    res.set(SECURITY_HEADERS);
    if (req.secure) res.set('Strict-Transport-Security', 'max-age=63072000');
    next();
  });
  app.use('/api', (req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' });
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      if (req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({ message: 'Zahtjevi s drugih stranica nisu dopušteni.' });
      if (req.headers.origin) {
        try {
          const origin = new URL(req.headers.origin);
          const expected = process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN).origin : `${req.protocol}://${req.headers.host}`;
          if (origin.origin !== expected) return res.status(403).json({ message: 'Izvor zahtjeva ne odgovara ovoj aplikaciji.' });
        } catch { return res.status(403).json({ message: 'Neispravan izvor zahtjeva.' }); }
      }
    }
    const cookie = req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    const decoded = sessionCodec.open(cookie);
    if (decoded) {
      let session = sessions.get(decoded.id);
      if (!session) {
        for (const [id, cached] of sessions) if (cached.expires <= now()) sessions.delete(id);
        if (sessions.size >= 10000) sessions.delete(sessions.keys().next().value);
        session = { ...decoded, requests: new Map() };
        sessions.set(decoded.id, session);
      }
      req.pikaSession = session;
      req.sessionId = decoded.id;
    }
    next();
  });
  app.use(express.json({ limit: '1mb' }));

  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  const requireSession = req => {
    if (!req.pikaSession) throw new ApiError(401, 'Poveži svoj Pika API Club ključ za nastavak.', 'not_connected');
    return req.pikaSession;
  };
  const rateLimit = (key, limit) => {
    const timestamp = now();
    if (rates.size > 5000) for (const [id, record] of rates) if (record.until < timestamp) rates.delete(id);
    const record = rates.get(key);
    if (!record || record.until < timestamp) { rates.set(key, { count: 1, until: timestamp + 60000 }); return; }
    if (++record.count > limit) throw new ApiError(429, 'Previše zahtjeva u kratkom vremenu. Pričekaj minutu i pokušaj ponovno.', 'rate_limited');
  };
  const sanitize = (value, key) => {
    if (!key || !value) return value;
    return JSON.parse(JSON.stringify(value).split(key).join('[redacted]'));
  };
  const upstream = async (pathname, { key, method = 'GET', body, headers = {}, timeout = 30000 } = {}) => {
    // All authenticated calls use a fixed origin, and redirects never receive credentials.
    if (!pathname.startsWith('/') || pathname.startsWith('//')) throw new ApiError(400, 'Neispravna putanja API-ja.');
    let response;
    try {
      response = await fetchImpl(API_ORIGIN + pathname, {
        method, headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(key ? { 'X-API-Key': key } : {}), ...headers },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}), redirect: 'error', signal: AbortSignal.timeout(timeout),
      });
    } catch {
      throw new ApiError(502, method === 'POST' && pathname.startsWith('/v1/media/') && !pathname.endsWith('/uploads')
        ? 'Pika nije odgovorio. Zahtjev je možda prihvaćen; ponovi ga s istim ID-jem kako bi ga oporavio bez dvostrukog slanja.'
        : 'Pika je trenutačno nedostupan. Pokušaj ponovno za nekoliko trenutaka.', 'upstream_unavailable');
    }
    const parsed = await response.json().catch(() => ({}));
    const data = sanitize(parsed && typeof parsed === 'object' ? parsed : {}, key);
    if (!response.ok) throw new ApiError(response.status, upstreamMessage(response.status, data), data.error?.code, data.id ? data : undefined);
    return data;
  };
  const getCatalog = async () => {
    if (catalogCache && catalogCache.expires > now()) return catalogCache.data;
    const data = await upstream('/catalog/apis');
    if (!Array.isArray(data.apis)) throw new ApiError(502, 'Pika je vratio neispravan katalog modela.');
    // The studio runs asynchronous media operations; LLM protocols have different contracts.
    const result = { apis: data.apis.filter(entry => API_ID.test(entry.api_id) && !NON_MEDIA_CATEGORIES.has(entry.category)
      && entry.call?.method === 'POST' && entry.call?.path?.startsWith('/v1/media/')) };
    catalogCache = { data: result, expires: now() + 300000 };
    return result;
  };
  const getDetail = async apiId => {
    if (typeof apiId !== 'string' || !API_ID.test(apiId)) throw new ApiError(400, 'Odaberi valjanu operaciju modela.');
    const cached = details.get(apiId);
    if (cached && cached.expires > now()) return cached.data;
    const catalog = await getCatalog();
    if (!catalog.apis.some(x => x.api_id === apiId)) throw new ApiError(404, 'Ova operacija nije u aktualnom Pika katalogu.');
    const detail = await upstream(`/catalog/apis/${apiId}?expand=inputs`);
    if (detail.call?.method !== 'POST' || detail.call?.path !== `/v1/media/${apiId}` || !detail.input_schema) throw new ApiError(502, 'Ovaj model ne nudi podržanu medijsku operaciju.');
    details.set(apiId, { data: detail, expires: now() + 300000 });
    return detail;
  };
  const validateInput = body => {
    if (!body || typeof body.input !== 'object' || body.input === null || Array.isArray(body.input)) throw new ApiError(400, 'Ulazne postavke moraju biti JSON objekt.');
    if (Object.hasOwn(body.input, 'webhook_url')) throw new ApiError(400, 'Studio prati status zahtjeva; webhook_url nije podržan.');
  };
  const quote = async (apiId, input, key) => {
    const result = await upstream(`/catalog/apis/${apiId}/quote`, { method: 'POST', key, body: input });
    if (!Number.isSafeInteger(result.micro_usd) || result.micro_usd < 0) throw new ApiError(502, 'Pika je vratio neispravnu cijenu. Pokušaj ponovno.');
    return result;
  };

  app.get('/api/health', (_req, res) => res.json({ ok: true, provider: 'Pika API Club' }));
  app.get('/api/catalog', wrap(async (_req, res) => res.json(await getCatalog())));
  app.get('/api/catalog/detail', wrap(async (req, res) => res.json(await getDetail(req.query.apiId))));
  app.post('/api/connect', wrap(async (req, res) => {
    rateLimit(`connect:${req.ip}`, 20);
    const apiKey = req.body?.apiKey;
    if (typeof apiKey !== 'string' || apiKey.trim().length < 8 || Buffer.byteLength(apiKey, 'utf8') > 1024 || /[\r\n]/.test(apiKey)) throw new ApiError(400, 'Unesi valjani Pika API ključ.');
    const key = apiKey.trim();
    const balance = await upstream('/billing/balance', { key });
    if (!Number.isFinite(balance.balance_micro_usd)) throw new ApiError(502, 'Pika je vratio neispravno stanje računa.');
    if (req.sessionId) sessions.delete(req.sessionId);
    // Only the encrypted, authenticated cookie carries credentials across instances.
    for (const [id, session] of sessions) if (session.expires <= now()) sessions.delete(id);
    if (sessions.size >= 10000) sessions.delete(sessions.keys().next().value);
    const { session, token } = sessionCodec.create(key);
    sessions.set(session.id, { ...session, balance, requests: new Map() });
    res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: req.secure || sessionCodec.production, path: '/', maxAge: SESSION_TTL });
    res.json({ connected: true, balance });
  }));
  app.get('/api/session', wrap(async (req, res) => {
    if (!req.pikaSession) return res.json({ connected: false });
    const balance = await upstream('/billing/balance', { key: req.pikaSession.key });
    req.pikaSession.balance = balance;
    res.json({ connected: true, balance });
  }));
  app.delete('/api/session', (req, res) => {
    if (req.sessionId) sessions.delete(req.sessionId);
    res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: req.secure || sessionCodec.production, path: '/' });
    res.json({ connected: false });
  });
  app.post('/api/quote', wrap(async (req, res) => {
    rateLimit(`quote:${req.ip}`, 100);
    validateInput(req.body);
    await getDetail(req.body.apiId);
    res.json(await quote(req.body.apiId, req.body.input, req.pikaSession?.key));
  }));
  app.post('/api/generate', wrap(async (req, res) => {
    const session = requireSession(req);
    rateLimit(`generate:${req.sessionId}`, 20);
    validateInput(req.body);
    const { apiId, input, requestId, maxCostMicroUsd } = req.body;
    if (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(requestId)) throw new ApiError(400, 'Za sigurno ponavljanje generiranja potreban je stabilan ID zahtjeva.');
    if (maxCostMicroUsd !== undefined && (!Number.isSafeInteger(maxCostMicroUsd) || maxCostMicroUsd < 0)) throw new ApiError(400, 'Neispravno ograničenje cijene generiranja.');
    const detail = await getDetail(apiId);
    const fingerprint = JSON.stringify({ apiId, input });
    const existing = session.requests.get(requestId);
    if (existing && existing.fingerprint !== fingerprint) throw new ApiError(409, 'Ovaj ID zahtjeva već je korišten s drugačijim postavkama.');
    if (existing?.job?.id) return res.json(await upstream(`/v1/media/jobs/${encodeURIComponent(existing.job.id)}`, { key: session.key }));
    if (existing?.promise) return res.json(await existing.promise);
    // A replay after a network timeout must bypass fresh budget checks: Pika may
    // already have charged the accepted job. Its stable idempotency key recovers it.
    if (!existing) {
    const price = await quote(apiId, input, session.key);
    if (maxCostMicroUsd !== undefined && price.micro_usd > maxCostMicroUsd) throw new ApiError(409, 'Cijena se promijenila. Provjeri novu cijenu prije generiranja.', 'price_changed');
    const balance = await upstream('/billing/balance', { key: session.key });
    const available = balance.postpaid?.active ? balance.postpaid.cycle?.remaining_micro_usd : balance.balance_micro_usd;
    if (!Number.isFinite(available)) throw new ApiError(502, 'Nije moguće potvrditi raspoloživo stanje Pika računa.');
    if (available < price.micro_usd) throw new ApiError(402, 'Stanje Pika računa ne pokriva ovo generiranje. Nadoplati sredstva na Pika računu.', 'insufficient_balance');
    if (!existing && session.requests.size >= 1000) throw new ApiError(429, 'Dosegnuto je ograničenje generiranja za ovu sesiju. Ponovno poveži ključ za novu sesiju.');
    }
    const record = { fingerprint };
    const submit = upstream(detail.call.path, { key: session.key, method: 'POST', body: input, headers: { 'Idempotency-Key': requestId }, timeout: 60000 });
    record.promise = submit;
    session.requests.set(requestId, record);
    try {
      const job = await submit;
      if (!job.id || !JOB_ID.test(job.id) || !['queued', 'running', 'completed', 'failed'].includes(job.status)) throw new ApiError(502, 'Pika je vratio neočekivan odgovor. Zadrži ovaj ID zahtjeva pri ponovnom pokušaju.');
      record.job = job;
      res.json(job);
    } catch (error) {
      if (error.job?.id) record.job = error.job;
      throw error;
    } finally { delete record.promise; }
  }));
  app.get('/api/jobs/:id', wrap(async (req, res) => {
    const session = requireSession(req);
    if (!JOB_ID.test(req.params.id)) throw new ApiError(400, 'Neispravan ID generiranja.');
    res.json(await upstream(`/v1/media/jobs/${req.params.id}`, { key: session.key }));
  }));
  const validateUploadSize = (type, size) => {
    if (!MIME_TYPES.has(type)) throw new ApiError(415, 'Učitaj podržanu sliku, video ili audio datoteku.');
    if (!Number.isSafeInteger(size) || size <= 0) throw new ApiError(400, 'Datoteka je prazna ili joj je veličina neispravna.');
    const limit = type.startsWith('video/') ? 50 * 1024 * 1024 : 20 * 1024 * 1024;
    if (size > limit) throw new ApiError(413, `Datoteka mora biti manja od ${limit / 1024 / 1024} MB.`);
  };
  const prepareUpload = async (session, type, size) => {
    validateUploadSize(type, size);
    const upload = await upstream('/v1/media/uploads', { key: session.key, method: 'POST', body: { content_type: type, size_bytes: size } });
    let url, reference;
    try { url = new URL(upload.upload_url); reference = new URL(upload.url); }
    catch { throw new ApiError(502, 'Pika je vratio neispravnu adresu za prijenos.'); }
    const allowedHost = url.hostname.endsWith('.pika.art') || url.hostname.endsWith('.amazonaws.com') || url.hostname.endsWith('.r2.cloudflarestorage.com') || url.hostname === 'storage.googleapis.com';
    if (url.protocol !== 'https:' || !allowedHost || url.username || url.password || (url.port && url.port !== '443')) throw new ApiError(502, 'Pika je vratio nepodržano odredište za prijenos.');
    if (reference.protocol !== 'https:' || reference.username || reference.password) throw new ApiError(502, 'Pika je vratio neispravnu adresu reference.');
    if (upload.method !== undefined && upload.method !== 'PUT') throw new ApiError(502, 'Pika je vratio nepodržanu metodu prijenosa.');
    if (!upload.headers || typeof upload.headers !== 'object' || Array.isArray(upload.headers)) throw new ApiError(502, 'Pika je vratio neispravna zaglavlja prijenosa.');
    const headers = {};
    for (const [name, value] of Object.entries(upload.headers)) {
      // Credentials and browser-controlled request context must never be forwarded to storage.
      if (!/^(content-type|content-length|x-amz-[a-z0-9-]+|x-goog-[a-z0-9-]+)$/i.test(name) || typeof value !== 'string' || /[\r\n]/.test(value)) throw new ApiError(502, 'Pika je vratio nepodržana zaglavlja prijenosa.');
      if (Object.keys(headers).some(existing => existing.toLowerCase() === name.toLowerCase())) throw new ApiError(502, 'Pika je vratio dvostruka zaglavlja prijenosa.');
      headers[name] = value;
    }
    const lowerHeaders = Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));
    if (lowerHeaders['content-type'] !== type || lowerHeaders['content-length'] !== String(size)) throw new ApiError(502, 'Zaglavlja prijenosa ne odgovaraju ovoj datoteci.');
    if (upload.max_bytes !== undefined && (!Number.isSafeInteger(upload.max_bytes) || upload.max_bytes < size)) throw new ApiError(502, 'Pika ne može primiti datoteku ove veličine.');
    return { uploadUrl: url.href, url: reference.href, headers };
  };
  app.post('/api/uploads/prepare', wrap(async (req, res) => {
    const session = requireSession(req);
    rateLimit(`upload:${req.sessionId}`, 30);
    const { contentType, sizeBytes } = req.body || {};
    // Only this small JSON request crosses the Vercel Function payload limit.
    res.json(await prepareUpload(session, contentType, sizeBytes));
  }));
  app.post('/api/uploads', (req, _res, next) => {
    // Reject unauthenticated uploads before buffering a potentially large body.
    try {
      requireSession(req);
      rateLimit(`upload:${req.sessionId}`, 30);
      const type = req.headers['content-type']?.split(';')[0];
      if (!MIME_TYPES.has(type)) throw new ApiError(415, 'Učitaj podržanu sliku, video ili audio datoteku.');
      next();
    } catch (error) { next(error); }
  }, express.raw({ type: () => true, limit: '50mb' }), wrap(async (req, res) => {
    const session = req.pikaSession;
    const type = req.headers['content-type']?.split(';')[0];
    if (!Buffer.isBuffer(req.body)) throw new ApiError(400, 'Učitana datoteka je prazna.');
    const upload = await prepareUpload(session, type, req.body.length);
    let response;
    try { response = await fetchImpl(upload.uploadUrl, { method: 'PUT', headers: upload.headers, body: req.body, redirect: 'error', signal: AbortSignal.timeout(60000) }); }
    catch { throw new ApiError(502, 'Prijenos reference nije uspio. Pokušaj ponovno.'); }
    if (!response.ok) throw new ApiError(502, 'Pika nije mogao spremiti referentnu datoteku. Pokušaj ponovno.');
    res.json({ url: upload.url });
  }));
  app.use('/api', (_req, res) => res.status(404).json({ message: 'API ruta ne postoji.' }));
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Datoteka ili zahtjev su preveliki.' });
    if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ message: 'Tijelo zahtjeva nije valjani JSON.' });
    const status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 ? error.status : 500;
    res.status(status).json({ message: status === 500 ? 'Došlo je do neočekivane greške na poslužitelju.' : error.message, ...(error.code ? { code: error.code } : {}), ...(error.job ? { job: error.job } : {}) });
  });
  const dist = distDir || path.resolve(fileURLToPath(new URL('..', import.meta.url)), 'dist');
  if (serveStatic && existsSync(dist)) {
    // Vite fingerprints /assets, so they never change; a missing chunk must 404, not return HTML.
    app.use('/assets', express.static(path.join(dist, 'assets'), { index: false, immutable: true, maxAge: '1y', fallthrough: false }));
    app.use(express.static(dist, {
      index: false,
      maxAge: '1d',
      setHeaders: (res, file) => { if (file.endsWith('.html')) res.set('Cache-Control', 'no-cache'); },
    }));
    app.get('/{*path}', (_req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(dist, 'index.html')));
  }
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.API_PORT || process.env.PORT || 3001);
  createApp().listen(port, '0.0.0.0', () => console.log(`Frame API listening on http://0.0.0.0:${port}`));
}
