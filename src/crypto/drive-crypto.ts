/**
 * Backup encryption & decryption for Google Drive appDataFolder
 * Uses PBKDF2 with 600,000 iterations + AES-256-GCM.
 */

import { E2EECrypto } from './e2ee.ts';
import type { BackupData } from '../types/index.ts';

const BACKUP_PBKDF2_ITERATIONS = 600000;

export class DriveCrypto {
  /**
   * Encrypts BackupData object using a user-specified passphrase.
   */
  public static async encryptBackup(backupData: BackupData, passphrase: string): Promise<string> {
    const jsonStr = JSON.stringify(backupData);
    const encoder = new TextEncoder();
    const data = encoder.encode(jsonStr);

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const passphraseBuffer = encoder.encode(passphrase);
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passphraseBuffer,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const aesKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: BACKUP_PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      aesKey,
      data
    );

    const payload = {
      salt: E2EECrypto.arrayBufferToBase64(salt.buffer),
      iv: E2EECrypto.arrayBufferToBase64(iv.buffer),
      ciphertext: E2EECrypto.arrayBufferToBase64(encrypted)
    };

    return JSON.stringify(payload);
  }

  /**
   * Decrypts encrypted backup JSON string using passphrase.
   */
  public static async decryptBackup(encryptedPayloadJson: string, passphrase: string): Promise<BackupData> {
    const payload = JSON.parse(encryptedPayloadJson);
    const salt = new Uint8Array(E2EECrypto.base64ToArrayBuffer(payload.salt));
    const iv = new Uint8Array(E2EECrypto.base64ToArrayBuffer(payload.iv));
    const ciphertext = E2EECrypto.base64ToArrayBuffer(payload.ciphertext);

    const encoder = new TextEncoder();
    const passphraseBuffer = encoder.encode(passphrase);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passphraseBuffer,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const aesKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: BACKUP_PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      aesKey,
      ciphertext
    );

    const decoder = new TextDecoder();
    const jsonStr = decoder.decode(decrypted);
    return JSON.parse(jsonStr) as BackupData;
  }
}
