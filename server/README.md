# Pika API Club integration

The app uses the real Pika API Club API at `https://api.dev.pika.art`. It does not use Higgsfield APIs or credentials.

## Verified official sources

Read on 2026-11-01:

- [API discovery and integration guide](https://dev.pika.art/llms.txt)
- [OpenAPI specification](https://dev.pika.art/openapi.json)
- [Live model catalog](https://api.dev.pika.art/catalog/apis)
- [Pika 2.5 text-to-video specification](https://dev.pika.art/llms/pika/pika-2.5/text-to-video)
- [Expanded live Pika 2.5 input schema](https://api.dev.pika.art/catalog/apis/pika/pika-2.5/text-to-video?expand=inputs)

Model parameters and prices are fetched at runtime. The studio exposes asynchronous media models; synchronous LLM and decision APIs have separate contracts and are excluded. Every generation is a real, potentially billable request. Quotes and account balance reads are free. A valid API Club key, active account, and enough available credit are needed to generate.

## Frontend contract

All routes return JSON. Errors return `{ message, code?, job? }`. Keep a returned `job.id`, including failed job envelopes. A network failure after submitting is an uncertain outcome, not proof that the generation did not start.

| Route | Input | Output |
| --- | --- | --- |
| `GET /api/catalog` | — | `{ apis: CatalogEntry[] }` |
| `GET /api/catalog/detail?apiId=vendor/model/function` | Operation ID | Catalog entry with expanded `input_schema` |
| `POST /api/connect` | `{ apiKey }` | `{ connected: true, balance }` plus HttpOnly session cookie |
| `GET /api/session` | Session cookie | `{ connected: false }` or `{ connected: true, balance }` |
| `DELETE /api/session` | Session cookie | `{ connected: false }`, clears this browser's session cookie |
| `POST /api/quote` | `{ apiId, input }` | `{ sell_usd: string, micro_usd: number }` |
| `POST /api/generate` | `{ apiId, input, requestId, maxCostMicroUsd? }` | Pika job envelope |
| `GET /api/jobs/:id` | Session cookie | Current Pika job envelope |
| `POST /api/uploads/prepare` | `{ contentType, sizeBytes }` | `{ uploadUrl, headers, url }` for direct browser PUT |
| `POST /api/uploads` | Raw file body, actual `Content-Type` (local compatibility route) | `{ url }` for model reference fields |
| `GET /api/health` | — | `{ ok: true, provider: 'Pika API Club' }` |

`requestId` must be a stable 16–128 character identifier (letters, numbers, underscore, hyphen). Use a UUID. Preserve it when retrying the exact same submission after a lost response. Use a fresh ID for a deliberately new generation, changed inputs, or retry of a confirmed failed job. The backend forwards it as Pika's documented `Idempotency-Key` and also rejects conflicting inputs within a warm instance's session cache. `maxCostMicroUsd` lets the frontend bind a submission to the price the user saw.

Job `status` is `queued`, `running`, `completed`, or `failed`. Poll the existing ID with a delay; never create a new job to check progress. Completed results contain URLs within `output`, e.g. `output.video.url`. Record final charges only when `billing.state` equals `settled`; `billing.charge_micro_usd / 1000000` is the US dollar amount.

Uploads use Pika's documented presigned upload flow. The browser requests a signed destination with a small authenticated JSON request, then sends the file directly to storage, avoiding Vercel's Function body limit. Images/audio are capped at 20 MB and videos at 50 MB. The backend verifies the destination, method, and signed headers before returning them. The browser sends the returned `Content-Type`; its File request body supplies the exact signed `Content-Length` automatically (JavaScript cannot set that header). Storage PUTs omit app cookies and never contain the Pika API key. The server only accepts HTTPS upload URLs on Pika, Amazon S3, Google Cloud Storage, or Cloudflare R2 hosts. The raw-body route remains available for local clients; deployments must use the prepare route for larger files.

Direct browser uploads require the provider's storage to permit the app origin in its CORS policy. Pika's published OpenAPI and integration guide describe the signed PUT contract but do not document a CORS guarantee. The request contract is covered by mocked tests; a real authenticated storage PUT still needs verification with an API Club key. If storage refuses a browser upload, the studio shows a retry message and accepts an already hosted public reference URL.

## Running and deployment

- `npm run dev`: API on port 3001 and Vite on 5173, proxied under one browser origin.
- `npm run build && npm start`: Express serves `dist/` and `/api` together. `PORT` or `API_PORT` overrides port 3001.
- `npm test`: mocked HTTP integration tests; no paid generations.
- Production startup requires a server-only `SESSION_SECRET` containing 64 hexadecimal characters from 32 cryptographically random bytes. Configure the same value for all replicas of a deployment; never prefix it with `VITE_` or commit it. Rotating it signs out existing sessions. Development uses a process-local random secret when no value is configured.
- If deploying behind a reverse proxy, use HTTPS and preserve the public `Host`, or set `APP_ORIGIN` to the public application origin. Express trusts one proxy hop for its secure cookie detection.
- `HTTPS_PROXY` is supported for outbound requests in managed environments.

Keys are verified using the free balance endpoint. An AES-256-GCM authenticated encrypted cookie stores the key and a fixed 12-hour expiry; only the server's `SESSION_SECRET` can decrypt it. It is HttpOnly and SameSite=Lax, with Secure required in production and on HTTPS. The plaintext key is never returned to JavaScript, logged, or written to disk. Sessions survive cold starts and work across replicas sharing the same secret. Disconnect deletes the browser cookie and the local cache entry. Like other stateless credentials, a previously copied cookie remains valid until its expiry or secret rotation; immediate global revocation would require shared persistent storage. App/library metadata persistence is handled by the frontend and contains no API keys.

The in-memory request cache and rate limits are instance-local optimizations. Provider idempotency remains authoritative across replicas. After an uncertain submission and a cold start, a fresh balance or price check can prevent replay if the accepted job already consumed the remaining credit; the frontend preserves the pending request and original idempotency key instead of silently creating a second submission. Accepted jobs with an ID can always be polled directly. A shared durable request ledger is needed for unconditional cross-instance recovery and coordinated app-side rate limiting.

The server checks current catalog membership, quotes/validates input with the provider, checks balance (including postpaid capacity), and blocks a submit if funds are insufficient or the quoted price exceeds the user's displayed limit. It never automatically switches models or automatically retries paid generations.

## Validation

Tests cover key validation/redaction, encrypted sessions across fresh instances, tamper/expiry rejection, production secret requirements, secure cookie behavior, disconnect, origin checks, path rejection, dynamic catalog filtering, keyless quotes, generation authorization, price/balance gates, request replay, uncertain-response recovery, failed job IDs, signed file uploads, direct-upload preparation/size validation, unsafe storage destinations/headers, and rejecting unauthenticated uploads before buffering.

Public catalog connectivity was verified against the real provider (151 asynchronous media operations at implementation time). Authenticated generation cannot be verified without the user's key; the integration tests mock the official response contracts rather than claiming to have generated real media.
