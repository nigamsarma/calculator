/**
 * Encrypted 1-to-1 Chat Interface & Controller
 */

import { E2EECrypto } from '../crypto/e2ee.ts';
import { WebSocketClient } from '../services/ws.ts';
import { SafetyCodeModalComponent } from './SafetyCodeModal.ts';
import { SettingsViewComponent } from './SettingsView.ts';
import type { LocalStorageManager } from '../db/storage.ts';
import type { Message, UserSession } from '../types/index.ts';

export class ChatAppComponent {
  private container: HTMLElement;
  private storage: LocalStorageManager;
  private backendUrl: string;
  private session: UserSession;
  private roomId: string;
  private pin: string;
  private onLockApp: () => void;

  private wsClient: WebSocketClient | null = null;
  private ownKeyPair: CryptoKeyPair | null = null;
  private peerPublicKey: CryptoKey | null = null;
  private aesSessionKey: CryptoKey | null = null;
  private safetyCode: string = '------';

  private messages: Message[] = [];
  private isPeerOnline: boolean = false;
  private isPeerTyping: boolean = false;
  private typingTimeout: any = null;
  private disappearingTimer: number = 0; // default off

  constructor(
    container: HTMLElement,
    storage: LocalStorageManager,
    backendUrl: string,
    session: UserSession,
    roomId: string,
    pin: string,
    onLockApp: () => void
  ) {
    this.container = container;
    this.storage = storage;
    this.backendUrl = backendUrl;
    this.session = session;
    this.roomId = roomId;
    this.pin = pin;
    this.onLockApp = onLockApp;
  }

  public async init(): Promise<void> {
    // Generate identity keypair
    const { keyPair, publicKeyJwk } = await E2EECrypto.generateIdentityKeyPair();
    this.ownKeyPair = keyPair;

    // Load stored messages
    this.messages = await this.storage.getMessages(this.roomId);

    // Initialize WebSocket
    this.wsClient = new WebSocketClient(
      this.backendUrl,
      this.roomId,
      this.session.userId,
      (msg) => this.handleWsMessage(msg)
    );
    this.wsClient.connect();

    this.render();
  }

  public render(): void {
    this.container.innerHTML = `
      <div class="chat-container">
        <!-- Header -->
        <div class="chat-header">
          <div class="chat-header-title">
            <span class="chat-status-dot ${this.isPeerOnline ? 'online' : ''}"></span>
            <span>Private Chat</span>
          </div>

          <div class="chat-actions">
            <!-- Disappearing Timer Selector -->
            <select id="chat-disappearing-select" style="background: var(--bg-tertiary); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 6px; font-size: 0.8rem; outline: none;">
              <option value="0" ${this.disappearingTimer === 0 ? 'selected' : ''}>⏳ Timer: Off</option>
              <option value="3600" ${this.disappearingTimer === 3600 ? 'selected' : ''}>⏳ 1 Hour</option>
              <option value="86400" ${this.disappearingTimer === 86400 ? 'selected' : ''}>⏳ 1 Day</option>
              <option value="604800" ${this.disappearingTimer === 604800 ? 'selected' : ''}>⏳ 1 Week</option>
            </select>

            <button id="btn-safety-code" class="icon-btn" title="View Safety Code">🛡️</button>
            <button id="btn-chat-settings" class="icon-btn" title="Settings">⚙️</button>
            <button id="btn-panic-lock" class="icon-btn" title="Lock Calculator">🔒</button>
          </div>
        </div>

        <!-- Messages Area -->
        <div class="chat-messages" id="chat-messages-list">
          ${this.messages.map((msg) => this.renderMessageBubble(msg)).join('')}
        </div>

        <!-- Typing Indicator -->
        <div id="typing-indicator" class="typing-indicator" style="display: ${this.isPeerTyping ? 'block' : 'none'};">
          Partner is typing...
        </div>

        <!-- Input Bar -->
        <div class="chat-input-bar">
          <input type="file" id="file-input-image" accept="image/*" style="display: none;" />
          <button id="btn-attach-img" class="icon-btn">📷</button>
          
          <input type="text" id="chat-text-input" class="chat-input" placeholder="Type an encrypted message..." />
          <button id="btn-send-msg" class="modal-btn" style="padding: 8px 16px;">Send</button>
        </div>
      </div>
    `;

    this.attachEventListeners();
    this.scrollToBottom();
  }

  private renderMessageBubble(msg: Message): string {
    const isSent = msg.senderId === this.session.userId;
    const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let ticks = '✓';
    if (msg.status === 'delivered') ticks = '✓✓';
    if (msg.status === 'read') ticks = '<span style="color: #64b5f6;">✓✓</span>';

    let contentHtml = '';
    if (msg.type === 'image') {
      contentHtml = `<img src="${msg.content}" class="msg-img" />`;
    } else {
      contentHtml = this.escapeHtml(msg.content);
    }

    return `
      <div class="msg-bubble ${isSent ? 'sent' : 'received'}" data-id="${msg.id}">
        ${contentHtml}
        <div class="msg-meta">
          <span>${timeStr}</span>
          ${isSent ? `<span>${ticks}</span>` : ''}
          <button class="btn-delete-msg" data-id="${msg.id}" style="background: none; border: none; color: inherit; cursor: pointer; font-size: 0.7rem; opacity: 0.6; margin-left: 6px;">🗑️</button>
        </div>
      </div>
    `;
  }

  private attachEventListeners(): void {
    const textInput = this.container.querySelector('#chat-text-input') as HTMLInputElement;
    const sendBtn = this.container.querySelector('#btn-send-msg') as HTMLButtonElement;
    const attachBtn = this.container.querySelector('#btn-attach-img') as HTMLButtonElement;
    const fileInput = this.container.querySelector('#file-input-image') as HTMLInputElement;
    const lockBtn = this.container.querySelector('#btn-panic-lock') as HTMLButtonElement;
    const settingsBtn = this.container.querySelector('#btn-chat-settings') as HTMLButtonElement;
    const safetyBtn = this.container.querySelector('#btn-safety-code') as HTMLButtonElement;
    const timerSelect = this.container.querySelector('#chat-disappearing-select') as HTMLSelectElement;

    // Send text message
    sendBtn.addEventListener('click', () => this.sendMessage());
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });

    // Typing indicator
    textInput.addEventListener('input', () => {
      if (this.wsClient) {
        this.wsClient.send({ type: 'typing', userId: this.session.userId, isTyping: true });
        if (this.typingTimeout) clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
          this.wsClient?.send({ type: 'typing', userId: this.session.userId, isTyping: false });
        }, 2000);
      }
    });

    // Attach image
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      const file = fileInput.files?.[0];
      if (file) {
        const compressedBase64 = await this.compressImage(file);
        await this.sendMessage('image', compressedBase64);
      }
    });

    // Disappearing timer selection
    if (timerSelect) {
      timerSelect.addEventListener('change', () => {
        this.disappearingTimer = parseInt(timerSelect.value, 10);
      });
    }

    // Safety code modal
    safetyBtn.addEventListener('click', () => {
      new SafetyCodeModalComponent(this.container, this.safetyCode).render();
    });

    // Settings view
    settingsBtn.addEventListener('click', () => {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      this.container.appendChild(modal);

      new SettingsViewComponent(
        modal,
        this.storage,
        () => modal.remove(),
        () => {
          modal.remove();
          this.onLockApp();
        }
      ).render();
    });

    // Lock calculator
    lockBtn.addEventListener('click', () => this.onLockApp());

    // Remote delete message event delegation
    const listEl = this.container.querySelector('#chat-messages-list');
    if (listEl) {
      listEl.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('btn-delete-msg')) {
          const msgId = target.dataset.id;
          if (msgId) {
            await this.deleteMessageBoth(msgId);
          }
        }
      });
    }
  }

  private async sendMessage(type: 'text' | 'image' = 'text', imagePayload?: string): Promise<void> {
    const textInput = this.container.querySelector('#chat-text-input') as HTMLInputElement;
    const content = type === 'image' ? imagePayload || '' : textInput.value.trim();

    if (!content) return;
    if (type === 'text') textInput.value = '';

    const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const timestamp = Date.now();
    const expiresAt = this.disappearingTimer > 0 ? timestamp + this.disappearingTimer * 1000 : undefined;

    const message: Message = {
      id: msgId,
      roomId: this.roomId,
      senderId: this.session.userId,
      content,
      type,
      timestamp,
      status: 'sending',
      disappearingTimer: this.disappearingTimer,
      expiresAt
    };

    // Save locally
    this.messages.push(message);
    await this.storage.saveMessage(message);
    this.render();

    // Encrypt and transmit over WebSocket if session key derived
    if (this.aesSessionKey && this.wsClient) {
      const encrypted = await E2EECrypto.encryptMessage(content, this.aesSessionKey);
      this.wsClient.send({
        type: 'chat_message',
        id: msgId,
        roomId: this.roomId,
        senderId: this.session.userId,
        ciphertext: encrypted.ciphertextBase64,
        iv: encrypted.ivBase64,
        msgType: type,
        timestamp,
        disappearingTimer: this.disappearingTimer
      });
      message.status = 'sent';
      await this.storage.saveMessage(message);
      this.render();
    }
  }

  private async handleWsMessage(data: any): Promise<void> {
    switch (data.type) {
      case 'ws_connected':
        this.isPeerOnline = true;
        // Share public key JWK
        if (this.ownKeyPair) {
          const jwk = await E2EECrypto.exportPublicKey(this.ownKeyPair.publicKey);
          this.wsClient?.send({
            type: 'pubkey_share',
            userId: this.session.userId,
            publicKeyJwk: jwk
          });
          this.wsClient?.send({
            type: 'request_peer_pubkey',
            userId: this.session.userId
          });
        }
        this.render();
        break;

      case 'ws_disconnected':
        this.isPeerOnline = false;
        this.render();
        break;

      case 'peer_pubkey':
        if (data.publicKeyJwk && this.ownKeyPair) {
          this.peerPublicKey = await E2EECrypto.importPeerPublicKey(data.publicKeyJwk);
          const derived = await E2EECrypto.deriveSharedKey(
            this.ownKeyPair.privateKey,
            this.peerPublicKey
          );
          this.aesSessionKey = derived.aesKey;
          this.safetyCode = derived.safetyCode;
          this.render();
        }
        break;

      case 'chat_message':
        await this.handleIncomingChatMessage(data);
        break;

      case 'ack_delivered':
        this.updateMessageStatus(data.messageId, 'delivered');
        break;

      case 'ack_read':
        this.updateMessageStatus(data.messageId, 'read');
        break;

      case 'typing':
        this.isPeerTyping = data.isTyping;
        const typingEl = this.container.querySelector('#typing-indicator') as HTMLElement;
        if (typingEl) typingEl.style.display = this.isPeerTyping ? 'block' : 'none';
        break;

      case 'delete_message':
        this.messages = this.messages.filter((m) => m.id !== data.messageId);
        await this.storage.deleteMessage(data.messageId);
        this.render();
        break;
    }
  }

  private async handleIncomingChatMessage(data: any): Promise<void> {
    if (!this.aesSessionKey) return;

    try {
      const plaintext = await E2EECrypto.decryptMessage(
        data.ciphertext,
        data.iv,
        this.aesSessionKey
      );

      const msg: Message = {
        id: data.id,
        roomId: data.roomId,
        senderId: data.senderId,
        content: plaintext,
        type: data.msgType || 'text',
        timestamp: data.timestamp,
        status: 'delivered',
        disappearingTimer: data.disappearingTimer,
        expiresAt: data.expiresAt
      };

      // Check duplicate
      if (!this.messages.some((m) => m.id === msg.id)) {
        this.messages.push(msg);
        await this.storage.saveMessage(msg);
        this.render();

        // Send delivery ack
        this.wsClient?.send({
          type: 'ack_delivered',
          messageId: msg.id,
          senderId: this.session.userId,
          status: 'delivered'
        });
      }
    } catch (e) {
      console.error('Failed to decrypt incoming message:', e);
    }
  }

  private async updateMessageStatus(messageId: string, status: 'delivered' | 'read'): Promise<void> {
    const msg = this.messages.find((m) => m.id === messageId);
    if (msg) {
      msg.status = status;
      await this.storage.saveMessage(msg);
      this.render();
    }
  }

  private async deleteMessageBoth(messageId: string): Promise<void> {
    this.messages = this.messages.filter((m) => m.id !== messageId);
    await this.storage.deleteMessage(messageId);
    this.wsClient?.send({
      type: 'delete_message',
      messageId,
      senderId: this.session.userId
    });
    this.render();
  }

  private async compressImage(file: File): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };

      reader.readAsDataURL(file);
    });
  }

  private scrollToBottom(): void {
    const listEl = this.container.querySelector('#chat-messages-list');
    if (listEl) {
      listEl.scrollTop = listEl.scrollHeight;
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  public destroy(): void {
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }
  }
}
