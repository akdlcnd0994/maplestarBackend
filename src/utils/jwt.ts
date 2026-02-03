// 간단한 JWT 구현 (Web Crypto API 사용)

interface JWTPayload {
  userId: number;
  username: string;
  role: string;
  exp: number;
}

const encoder = new TextEncoder();

async function createHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function base64UrlEncode(data: Uint8Array | string): string {
  const str = typeof data === 'string' ? data : String.fromCharCode(...data);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  return atob(base64 + padding);
}

export async function signJWT(payload: Omit<JWTPayload, 'exp'>, secret: string, expiresIn: number = 7 * 24 * 60 * 60): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = { ...payload, exp: now + expiresIn };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const message = `${headerB64}.${payloadB64}`;

  const key = await createHmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const signatureB64 = base64UrlEncode(new Uint8Array(signature));

  return `${message}.${signatureB64}`;
}

export type JWTVerifyResult =
  | { status: 'valid'; payload: JWTPayload }
  | { status: 'expired'; payload: JWTPayload }
  | { status: 'invalid'; payload: null };

export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  const result = await verifyJWTWithStatus(token, secret);
  if (result.status === 'valid') return result.payload;
  return null;
}

export async function verifyJWTWithStatus(token: string, secret: string): Promise<JWTVerifyResult> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { status: 'invalid', payload: null };

    const [headerB64, payloadB64, signatureB64] = parts;
    const message = `${headerB64}.${payloadB64}`;

    const key = await createHmacKey(secret);
    const signatureData = Uint8Array.from(base64UrlDecode(signatureB64), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, signatureData, encoder.encode(message));

    if (!valid) return { status: 'invalid', payload: null };

    const payload: JWTPayload = JSON.parse(base64UrlDecode(payloadB64));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp < now) {
      return { status: 'expired', payload };
    }

    return { status: 'valid', payload };
  } catch {
    return { status: 'invalid', payload: null };
  }
}
