export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  content: string; // Plaintext when decrypted in memory, ciphertext when stored/sent
  iv?: string;
  type: 'text' | 'image' | 'system';
  timestamp: number;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  disappearingTimer?: number; // In seconds (0 = off, 3600 = 1h, 86400 = 1d, 604800 = 1w)
  expiresAt?: number;
}

export interface UserSession {
  token: string;
  userId: string;
  email: string;
  name: string;
  picture?: string;
}

export interface RoomInfo {
  roomId: string;
  inviteKey?: string;
  peerId?: string;
  peerPublicKey?: string;
  safetyCode?: string;
  createdTime: number;
}

export interface BackupData {
  version: number;
  timestamp: number;
  messages: Message[];
  rooms: RoomInfo[];
  identityKeyJwk: JsonWebKey;
}

export interface Settings {
  autoLockDelay: number; // in seconds: 0 = immediate, 30, 60, 300
  notificationBodyIndex: number;
  customNotificationText: string[];
  disappearingTimerDefault: number;
  pinHash?: string;
  pinSalt?: string;
  failedPinAttempts: number;
  lastFailedPinTime: number;
}
