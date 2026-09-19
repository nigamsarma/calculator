/**
 * Durable Object for 1-to-1 Encrypted Chat Room & SQLite Message Relay
 */

import { DurableObject } from 'cloudflare:workers';
import { sendWebPushNotification, type WebPushSubscription } from './push.ts';

export class DurableChatRoom extends DurableObject {
  private sql: SqlStorage;
  private sessions: Set<WebSocket> = new Set();
  private userSockets: Map<string, WebSocket> = new Map();

  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    this.sql = state.storage.sql;
    this.initDatabase();
  }

  private initDatabase(): void {
    // Create tables in SQLite
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS room_info (
        room_id TEXT PRIMARY KEY,
        invite_key_hash TEXT,
        user_a_id TEXT,
        user_b_id TEXT,
        created_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        room_id TEXT,
        sender_id TEXT,
        ciphertext TEXT,
        iv TEXT,
        type TEXT,
        timestamp INTEGER,
        disappearing_timer INTEGER,
        expires_at INTEGER,
        delivered_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS push_subscriptions (
        user_id TEXT PRIMARY KEY,
        subscription_json TEXT,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS key_exchange (
        user_id TEXT PRIMARY KEY,
        public_key_jwk TEXT
      );
    `);
  }

  public async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/ws') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426 });
      }

      const userId = url.searchParams.get('userId');
      if (!userId) return new Response('Missing userId', { status: 400 });

      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      this.ctx.acceptWebSocket(server);
      this.sessions.add(server);
      this.userSockets.set(userId, server);

      // Flush offline messages queued for this user
      this.flushOfflineMessages(userId, server);

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Not found', { status: 404 });
  }

  public async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;

    try {
      const data = JSON.parse(message);
      const type = data.type;

      switch (type) {
        case 'pubkey_share':
          // Store user's ECDH public key JWK and relay to peer
          if (data.userId && data.publicKeyJwk) {
            this.sql.exec(
              `INSERT OR REPLACE INTO key_exchange (user_id, public_key_jwk) VALUES (?, ?)`,
              data.userId,
              JSON.stringify(data.publicKeyJwk)
            );
            this.broadcastToPeers(data.userId, {
              type: 'peer_pubkey',
              senderId: data.userId,
              publicKeyJwk: data.publicKeyJwk
            });
          }
          break;

        case 'request_peer_pubkey':
          // Retrieve stored peer public key if available
          const peerKeyRow = this.sql.exec(
            `SELECT public_key_jwk FROM key_exchange WHERE user_id != ? LIMIT 1`,
            data.userId
          ).toArray();

          if (peerKeyRow.length > 0) {
            ws.send(JSON.stringify({
              type: 'peer_pubkey',
              publicKeyJwk: JSON.parse((peerKeyRow[0] as any).public_key_jwk)
            }));
          }
          break;

        case 'chat_message':
          await this.handleChatMessage(data);
          break;

        case 'ack_delivered':
        case 'ack_read':
          this.handleAck(data);
          break;

        case 'typing':
          this.broadcastToPeers(data.userId, {
            type: 'typing',
            userId: data.userId,
            isTyping: data.isTyping
          });
          break;

        case 'delete_message':
          this.handleDeleteMessage(data);
          break;

        case 'push_subscription':
          if (data.userId && data.subscription) {
            this.sql.exec(
              `INSERT OR REPLACE INTO push_subscriptions (user_id, subscription_json, updated_at) VALUES (?, ?, ?)`,
              data.userId,
              JSON.stringify(data.subscription),
              Date.now()
            );
          }
          break;
      }
    } catch (e) {
      console.error('DO WebSocket message processing error:', e);
    }
  }

  private async handleChatMessage(data: any): Promise<void> {
    const { id, roomId, senderId, ciphertext, iv, msgType, timestamp, disappearingTimer } = data;
    const expiresAt = disappearingTimer > 0 ? timestamp + disappearingTimer * 1000 : null;

    // Store ciphertext in SQLite
    this.sql.exec(
      `INSERT OR REPLACE INTO messages (id, room_id, sender_id, ciphertext, iv, type, timestamp, disappearing_timer, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      roomId,
      senderId,
      ciphertext,
      iv,
      msgType || 'text',
      timestamp,
      disappearingTimer || 0,
      expiresAt
    );

    // Relay to online peer
    let deliveredToOnlinePeer = false;
    for (const [uid, socket] of this.userSockets.entries()) {
      if (uid !== senderId && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'chat_message',
          id,
          roomId,
          senderId,
          ciphertext,
          iv,
          msgType,
          timestamp,
          disappearingTimer,
          expiresAt
        }));
        deliveredToOnlinePeer = true;
      }
    }

    // Send Web Push notification if peer is offline
    if (!deliveredToOnlinePeer) {
      const peerSubRow = this.sql.exec(
        `SELECT subscription_json FROM push_subscriptions WHERE user_id != ? LIMIT 1`,
        senderId
      ).toArray();

      if (peerSubRow.length > 0) {
        const sub = JSON.parse((peerSubRow[0] as any).subscription_json);
        await sendWebPushNotification(
          sub,
          { trigger: 'new_msg' },
          {
            publicKey: (this.env as any).VAPID_PUBLIC_KEY || '',
            privateKey: (this.env as any).VAPID_PRIVATE_KEY || '',
            subject: (this.env as any).VAPID_SUBJECT || ''
          }
        );
      }
    }
  }

  private handleAck(data: any): void {
    const { messageId, senderId, status } = data;
    this.broadcastToPeers(senderId, {
      type: status === 'read' ? 'ack_read' : 'ack_delivered',
      messageId
    });
  }

  private handleDeleteMessage(data: any): void {
    const { messageId, senderId } = data;
    this.sql.exec(`DELETE FROM messages WHERE id = ?`, messageId);
    this.broadcastToPeers(senderId, {
      type: 'delete_message',
      messageId
    });
  }

  private flushOfflineMessages(userId: string, ws: WebSocket): void {
    const now = Date.now();
    // Query undelivered or stored messages for peer
    const rows = this.sql.exec(
      `SELECT * FROM messages WHERE sender_id != ? AND (expires_at IS NULL OR expires_at > ?) ORDER BY timestamp ASC`,
      userId,
      now
    ).toArray();

    for (const row of rows as any[]) {
      ws.send(JSON.stringify({
        type: 'chat_message',
        id: row.id,
        roomId: row.room_id,
        senderId: row.sender_id,
        ciphertext: row.ciphertext,
        iv: row.iv,
        msgType: row.type,
        timestamp: row.timestamp,
        disappearingTimer: row.disappearing_timer,
        expiresAt: row.expires_at
      }));
    }
  }

  private broadcastToPeers(senderId: string, payload: any): void {
    const str = JSON.stringify(payload);
    for (const [uid, socket] of this.userSockets.entries()) {
      if (uid !== senderId && socket.readyState === WebSocket.OPEN) {
        socket.send(str);
      }
    }
  }

  public webSocketClose(ws: WebSocket): void {
    this.sessions.delete(ws);
    for (const [uid, socket] of this.userSockets.entries()) {
      if (socket === ws) {
        this.userSockets.delete(uid);
        break;
      }
    }
  }
}
