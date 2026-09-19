/**
 * Authentication Helper: Google ID Token verification & JWT Session signing
 */

interface GoogleJwksKey {
  kty: string;
  alg: string;
  use: string;
  kid: string;
  n: string;
  e: string;
}

let jwksCache: { keys: GoogleJwksKey[]; fetchedAt: number } | null = null;

export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string
): Promise<{ userId: string; email: string; name: string; picture?: string }> {
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid Google ID token format');
  }

  const headerJson = atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'));
  const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));

  const header = JSON.parse(headerJson);
  const payload = JSON.parse(payloadJson);

  // Check expiration & issuer
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error('Google ID token expired');
  }

  if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') {
    throw new Error('Invalid Google ID token issuer');
  }

  if (payload.aud !== clientId) {
    throw new Error('Google ID token audience mismatch');
  }

  // Fetch Google JWKS keys if not cached
  if (!jwksCache || now - jwksCache.fetchedAt > 3600) {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
    if (!res.ok) throw new Error('Failed to fetch Google JWKS');
    const data = (await res.json()) as { keys: GoogleJwksKey[] };
    jwksCache = { keys: data.keys, fetchedAt: now };
  }

  const matchingKey = jwksCache.keys.find((k) => k.kid === header.kid);
  if (!matchingKey) {
    throw new Error('Matching JWKS key not found for ID token');
  }

  return {
    userId: payload.sub,
    email: payload.email,
    name: payload.name || payload.email,
    picture: payload.picture
  };
}

export async function createSessionToken(
  user: { userId: string; email: string; name: string },
  jwtSecret: string
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.userId,
    email: user.email,
    name: user.name,
    iat: now,
    exp: now + 30 * 24 * 3600 // 30 days
  };

  const base64UrlHeader = base64UrlEncode(JSON.stringify(header));
  const base64UrlPayload = base64UrlEncode(JSON.stringify(payload));

  const signatureInput = `${base64UrlHeader}.${base64UrlPayload}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(jwtSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBits = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureInput));
  const base64UrlSignature = arrayBufferToBase64Url(signatureBits);

  return `${signatureInput}.${base64UrlSignature}`;
}

export async function verifySessionToken(
  token: string,
  jwtSecret: string
): Promise<{ userId: string; email: string; name: string }> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token structure');

  const [headerB64, payloadB64, signatureB64] = parts;
  const signatureInput = `${headerB64}.${payloadB64}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(jwtSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signatureBytes = base64UrlToArrayBuffer(signatureB64);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    signatureBytes,
    encoder.encode(signatureInput)
  );

  if (!valid) throw new Error('Invalid session token signature');

  const payload = JSON.parse(base64UrlDecode(payloadB64));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new Error('Session token expired');

  return {
    userId: payload.sub,
    email: payload.email,
    name: payload.name
  };
}

function base64UrlEncode(str: string): string {
  const base64 = btoa(str);
  return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return atob(base64);
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64UrlEncode(binary);
}

function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const binaryString = base64UrlDecode(base64url);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
