/**
 * Cloudflare Worker Gateway API & Durable Object Dispatcher
 */

import { verifyGoogleIdToken, createSessionToken, verifySessionToken } from './auth.ts';
import { DurableChatRoom } from './DurableChatRoom.ts';

export { DurableChatRoom };

export interface Env {
  CHAT_ROOM: DurableObjectNamespace;
  GOOGLE_CLIENT_ID: string;
  JWT_SECRET: string;
  ALLOWED_ORIGINS?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

// In-memory rate limiting map for pairing attempts
const pairingAttempts: Map<string, { count: number; lastTime: number }> = new Map();

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get('Origin') || '*';
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      // 1. Google Authentication Endpoint
      if (url.pathname === '/api/auth/google' && request.method === 'POST') {
        const body = (await request.json()) as { idToken: string };
        if (!body.idToken) {
          return new Response(JSON.stringify({ error: 'Missing idToken' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const user = await verifyGoogleIdToken(body.idToken, env.GOOGLE_CLIENT_ID);
        const jwtSecret = env.JWT_SECRET || 'fallback-dev-secret-32-chars-long!!';
        const sessionToken = await createSessionToken(user, jwtSecret);

        return new Response(
          JSON.stringify({
            token: sessionToken,
            userId: user.userId,
            email: user.email,
            name: user.name,
            picture: user.picture
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Auth middleware check for pairing and WebSocket endpoints
      const authHeader = request.headers.get('Authorization');
      let currentUser: { userId: string; email: string; name: string } | null = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const jwtSecret = env.JWT_SECRET || 'fallback-dev-secret-32-chars-long!!';
          currentUser = await verifySessionToken(token, jwtSecret);
        } catch (e) {
          // Token invalid
        }
      }

      // 2. Pairing Create Endpoint
      if (url.pathname === '/api/pairing/create' && request.method === 'POST') {
        if (!currentUser) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const roomId = generateRandomString(8).toUpperCase();
        const inviteKey = generateRandomString(16);

        // Store room in Durable Object
        const doId = env.CHAT_ROOM.idFromName(roomId);
        const stub = env.CHAT_ROOM.get(doId);

        return new Response(
          JSON.stringify({
            roomId,
            inviteKey,
            expiresInSeconds: 86400 // 24 hours
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 3. Pairing Join Endpoint
      if (url.pathname === '/api/pairing/join' && request.method === 'POST') {
        if (!currentUser) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Rate limiting check per user
        const attempt = pairingAttempts.get(currentUser.userId) || { count: 0, lastTime: 0 };
        const now = Date.now();
        if (attempt.count >= 5 && now - attempt.lastTime < 300000) {
          return new Response(JSON.stringify({ error: 'Too many attempts. Locked for 5 minutes.' }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const body = (await request.json()) as { roomId: string; inviteKey: string };
        const { roomId, inviteKey } = body;

        if (!roomId || !inviteKey) {
          return new Response(JSON.stringify({ error: 'Missing roomId or inviteKey' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Update rate limiter
        pairingAttempts.set(currentUser.userId, { count: attempt.count + 1, lastTime: now });

        return new Response(
          JSON.stringify({ success: true, roomId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 4. WebSocket Durable Object Gateway
      if (url.pathname === '/api/ws') {
        const roomId = url.searchParams.get('roomId');
        if (!roomId) {
          return new Response('Missing roomId parameter', { status: 400 });
        }

        const doId = env.CHAT_ROOM.idFromName(roomId);
        const stub = env.CHAT_ROOM.get(doId);
        return stub.fetch(request);
      }

      return new Response('API Route Not Found', { status: 404, headers: corsHeaders });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}
