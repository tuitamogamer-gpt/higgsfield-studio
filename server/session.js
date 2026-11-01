import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const SESSION_TTL = 12 * 60 * 60 * 1000;
const DEVELOPMENT_SECRET = randomBytes(32);
const ASSOCIATED_DATA = Buffer.from('frame-session:v1');

// Only ciphertext is stored in the browser. A shared deployment secret lets
// every serverless instance authenticate the same HttpOnly session cookie.
export function createSessionCodec({
  secret = process.env.SESSION_SECRET,
  production = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1',
  now = Date.now,
} = {}) {
  if (!secret && production) throw new Error('SESSION_SECRET is required in production.');
  if (secret !== undefined && (typeof secret !== 'string' || !/^[a-fA-F0-9]{64}$/.test(secret))) {
    throw new Error('SESSION_SECRET must contain exactly 64 hexadecimal characters (32 random bytes).');
  }
  const encryptionKey = secret ? Buffer.from(secret, 'hex') : DEVELOPMENT_SECRET;

  const seal = session => {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
    cipher.setAAD(ASSOCIATED_DATA);
    const plaintext = JSON.stringify({ v: 1, id: session.id, key: session.key, expires: session.expires });
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
  };

  const open = token => {
    if (typeof token !== 'string' || token.length > 3000 || !/^[A-Za-z0-9_-]+$/.test(token)) return undefined;
    try {
      const packed = Buffer.from(token, 'base64url');
      if (packed.length < 29 || packed.toString('base64url') !== token) return undefined;
      const decipher = createDecipheriv('aes-256-gcm', encryptionKey, packed.subarray(0, 12));
      decipher.setAAD(ASSOCIATED_DATA);
      decipher.setAuthTag(packed.subarray(12, 28));
      const data = JSON.parse(Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString('utf8'));
      if (data.v !== 1 || typeof data.id !== 'string' || !/^[a-f0-9]{32}$/.test(data.id)
        || typeof data.key !== 'string' || data.key.length < 8 || Buffer.byteLength(data.key, 'utf8') > 1024 || /[\r\n]/.test(data.key)
        || !Number.isSafeInteger(data.expires) || data.expires <= now() || data.expires > now() + SESSION_TTL + 60000) return undefined;
      return { id: data.id, key: data.key, expires: data.expires };
    } catch { return undefined; }
  };

  const create = key => {
    const session = { id: randomBytes(16).toString('hex'), key, expires: now() + SESSION_TTL };
    return { session, token: seal(session) };
  };
  return { create, open, production };
}
