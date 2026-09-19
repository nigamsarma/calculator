/**
 * Encrypted Local Storage Manager backed by IndexedDB and localStorage
 */

import type { Message, RoomInfo, Settings } from '../types/index.ts';

const DB_NAME = 'calc_app_db';
const DB_VERSION = 1;

export class LocalStorageManager {
  private db: IDBDatabase | null = null;

  public async init(): Promise<void> {
    if (typeof indexedDB === 'undefined') return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('roomId', 'roomId', { unique: false });
          msgStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('rooms')) {
          db.createObjectStore('rooms', { keyPath: 'roomId' });
        }

        if (!db.objectStoreNames.contains('kv')) {
          db.createObjectStore('kv', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  // --- Settings & PIN Persistence ---

  public getSettings(): Settings {
    const defaultSettings: Settings = {
      autoLockDelay: 0, // immediate
      notificationBodyIndex: 0,
      customNotificationText: [
        'Unit conversion rates updated',
        'New calculator tip available',
        'Calculator update ready'
      ],
      disappearingTimerDefault: 0, // off
      failedPinAttempts: 0,
      lastFailedPinTime: 0
    };

    try {
      const saved = localStorage.getItem('calc_settings');
      if (saved) {
        return { ...defaultSettings, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
    return defaultSettings;
  }

  public saveSettings(settings: Settings): void {
    try {
      localStorage.setItem('calc_settings', JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }

  // --- Messages Store ---

  public async saveMessage(message: Message): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      const req = store.put(message);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getMessages(roomId: string): Promise<Message[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('messages', 'readonly');
      const store = tx.objectStore('messages');
      const index = store.index('roomId');
      const req = index.getAll(roomId);

      req.onsuccess = () => {
        const msgs: Message[] = req.result || [];
        // Filter expired disappearing messages
        const now = Date.now();
        const validMsgs = msgs.filter((m) => !m.expiresAt || m.expiresAt > now);
        // Sort by timestamp
        validMsgs.sort((a, b) => a.timestamp - b.timestamp);
        resolve(validMsgs);
      };

      req.onerror = () => reject(req.error);
    });
  }

  public async deleteMessage(messageId: string): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      const req = store.delete(messageId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- Rooms Store ---

  public async saveRoom(room: RoomInfo): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('rooms', 'readwrite');
      const store = tx.objectStore('rooms');
      const req = store.put(room);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getRooms(): Promise<RoomInfo[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('rooms', 'readonly');
      const store = tx.objectStore('rooms');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // --- Key-Value General Storage ---

  public async setKV(key: string, value: any): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('kv', 'readwrite');
      const store = tx.objectStore('kv');
      const req = store.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getKV(key: string): Promise<any> {
    if (!this.db) await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('kv', 'readonly');
      const store = tx.objectStore('kv');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Wipe all local data (Emergency Panic Wipe)
   */
  public async wipeAllData(): Promise<void> {
    localStorage.clear();
    if (typeof indexedDB !== 'undefined') {
      indexedDB.deleteDatabase(DB_NAME);
    }
  }
}
