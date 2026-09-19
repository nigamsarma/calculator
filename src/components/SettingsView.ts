/**
 * Settings Screen View Component
 */

import { PinManager } from '../crypto/pin.ts';
import { GoogleAuthService } from '../services/google.ts';
import { DriveCrypto } from '../crypto/drive-crypto.ts';
import type { LocalStorageManager } from '../db/storage.ts';

export type CloseSettingsCallback = () => void;
export type WipeDataCallback = () => void;

export class SettingsViewComponent {
  private container: HTMLElement;
  private storage: LocalStorageManager;
  private onClose: CloseSettingsCallback;
  private onWipe: WipeDataCallback;

  constructor(
    container: HTMLElement,
    storage: LocalStorageManager,
    onClose: CloseSettingsCallback,
    onWipe: WipeDataCallback
  ) {
    this.container = container;
    this.storage = storage;
    this.onClose = onClose;
    this.onWipe = onWipe;
  }

  public render(): void {
    const settings = this.storage.getSettings();

    this.container.innerHTML = `
      <div style="padding: 16px; max-width: 540px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; overflow-y: auto; height: 100%;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
          <h2 style="font-size: 1.2rem;">Chat & Security Settings</h2>
          <button id="settings-close-btn" class="icon-btn">✕</button>
        </div>

        <!-- Section 1: Security & Auto-Lock -->
        <div class="modal-card" style="max-width: 100%;">
          <div class="modal-title" style="text-align: left;">Security & Auto-Lock</div>
          
          <label style="font-size: 0.85rem; color: var(--text-muted);">Auto-Lock Delay when Backgrounded</label>
          <select id="setting-autolock" class="modal-input" style="font-size: 0.95rem; text-align: left;">
            <option value="0" ${settings.autoLockDelay === 0 ? 'selected' : ''}>Immediate (Default)</option>
            <option value="30" ${settings.autoLockDelay === 30 ? 'selected' : ''}>30 Seconds</option>
            <option value="60" ${settings.autoLockDelay === 60 ? 'selected' : ''}>1 Minute</option>
            <option value="300" ${settings.autoLockDelay === 300 ? 'selected' : ''}>5 Minutes</option>
          </select>

          <button id="btn-change-pin" class="modal-btn" style="background-color: var(--bg-tertiary);">Change Passcode PIN</button>
        </div>

        <!-- Section 2: Disguised Push Notification Wording -->
        <div class="modal-card" style="max-width: 100%;">
          <div class="modal-title" style="text-align: left;">Disguised Notifications</div>
          <div class="modal-subtitle" style="text-align: left;">
            Edit the random calculator messages shown when a push notification arrives while the app is closed.
          </div>

          <textarea id="setting-push-texts" class="modal-input" rows="3" style="font-size: 0.85rem; text-align: left; font-family: monospace;">${settings.customNotificationText.join('\n')}</textarea>
          
          <div style="font-size: 0.75rem; color: var(--text-muted); background: var(--bg-primary); padding: 8px; border-radius: 8px; border: 1px solid var(--border-color);">
            ℹ️ <b>Browser Push Notice:</b> Chrome requires all Web Push notifications to be visible. On iOS (iPhone), Web Push requires adding this app to your Home Screen. Tapping any notification opens the standard calculator gate.
          </div>

          <button id="btn-save-push-texts" class="modal-btn" style="background-color: var(--bg-tertiary);">Save Notification Wording</button>
        </div>

        <!-- Section 3: Encrypted Google Drive Backup -->
        <div class="modal-card" style="max-width: 100%;">
          <div class="modal-title" style="text-align: left;">Cloud Backup (Google Drive)</div>
          <div class="modal-subtitle" style="text-align: left;">
            Backups are zero-knowledge encrypted on your device (PBKDF2 600k + AES-256-GCM) and saved to your hidden Google Drive appDataFolder.
          </div>

          <input type="password" id="backup-passphrase" class="modal-input" placeholder="Backup Encryption Passphrase" />

          <div style="display: flex; gap: 8px;">
            <button id="btn-backup-now" class="modal-btn" style="flex: 1; background-color: var(--chat-sent);">Back Up Now</button>
            <button id="btn-restore-now" class="modal-btn" style="flex: 1; background-color: var(--bg-tertiary);">Restore Backup</button>
          </div>
        </div>

        <!-- Section 4: Emergency Wipe & Reset -->
        <div class="modal-card" style="max-width: 100%; border-color: #ff3b30;">
          <div class="modal-title" style="text-align: left; color: #ff3b30;">Danger Zone</div>
          <div class="modal-subtitle" style="text-align: left;">
            Permanently destroy all encrypted messages, keys, and settings stored on this device.
          </div>

          <button id="btn-wipe-data" class="modal-btn" style="background-color: #ff3b30;">Wipe All Local Data</button>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    const closeBtn = this.container.querySelector('#settings-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.onClose());

    // Auto-lock dropdown
    const autoLockSelect = this.container.querySelector('#setting-autolock') as HTMLSelectElement;
    if (autoLockSelect) {
      autoLockSelect.addEventListener('change', () => {
        const settings = this.storage.getSettings();
        settings.autoLockDelay = parseInt(autoLockSelect.value, 10);
        this.storage.saveSettings(settings);
      });
    }

    // Change PIN
    const changePinBtn = this.container.querySelector('#btn-change-pin');
    if (changePinBtn) {
      changePinBtn.addEventListener('click', async () => {
        const newPin = prompt('Enter new 6+ digit numeric PIN:');
        if (newPin && newPin.length >= 6 && /^\d+$/.test(newPin)) {
          const salt = PinManager.generateSalt();
          const hash = await PinManager.hashPin(newPin, salt);
          const settings = this.storage.getSettings();
          settings.pinSalt = salt;
          settings.pinHash = hash;
          this.storage.saveSettings(settings);
          alert('Passcode PIN successfully updated.');
        } else if (newPin) {
          alert('Invalid PIN format. Minimum 6 numeric digits required.');
        }
      });
    }

    // Save custom notification wording
    const savePushBtn = this.container.querySelector('#btn-save-push-texts');
    const pushTextArea = this.container.querySelector('#setting-push-texts') as HTMLTextAreaElement;
    if (savePushBtn && pushTextArea) {
      savePushBtn.addEventListener('click', () => {
        const lines = pushTextArea.value
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        if (lines.length > 0) {
          const settings = this.storage.getSettings();
          settings.customNotificationText = lines;
          this.storage.saveSettings(settings);
          alert('Notification wording list updated.');
        }
      });
    }

    // Backup & Restore
    const backupBtn = this.container.querySelector('#btn-backup-now');
    const restoreBtn = this.container.querySelector('#btn-restore-now');
    const passphraseInput = this.container.querySelector('#backup-passphrase') as HTMLInputElement;

    if (backupBtn) {
      backupBtn.addEventListener('click', async () => {
        const passphrase = passphraseInput.value.trim();
        if (!passphrase) {
          alert('Please enter a passphrase to encrypt your cloud backup.');
          return;
        }

        try {
          const token = await GoogleAuthService.getDriveAccessToken();
          const messages = await this.storage.getMessages('');
          const rooms = await this.storage.getRooms();

          const backupData = {
            version: 1,
            timestamp: Date.now(),
            messages,
            rooms,
            identityKeyJwk: {}
          };

          const encryptedJson = await DriveCrypto.encryptBackup(backupData, passphrase);
          await GoogleAuthService.uploadBackupToDrive(token, encryptedJson);
          alert('Encrypted backup successfully saved to Google Drive!');
        } catch (e: any) {
          alert(`Backup failed: ${e.message}`);
        }
      });
    }

    if (restoreBtn) {
      restoreBtn.addEventListener('click', async () => {
        const passphrase = passphraseInput.value.trim();
        if (!passphrase) {
          alert('Please enter your passphrase to decrypt the backup.');
          return;
        }

        try {
          const token = await GoogleAuthService.getDriveAccessToken();
          const encryptedJson = await GoogleAuthService.downloadBackupFromDrive(token);
          const backupData = await DriveCrypto.decryptBackup(encryptedJson, passphrase);

          for (const msg of backupData.messages) {
            await this.storage.saveMessage(msg);
          }
          for (const rm of backupData.rooms) {
            await this.storage.saveRoom(rm);
          }

          alert('Backup successfully decrypted and restored!');
        } catch (e: any) {
          alert(`Restore failed: ${e.message}`);
        }
      });
    }

    // Emergency Wipe
    const wipeBtn = this.container.querySelector('#btn-wipe-data');
    if (wipeBtn) {
      wipeBtn.addEventListener('click', async () => {
        if (confirm('ARE YOU SURE? This will permanently delete all messages and lock the app.')) {
          await this.storage.wipeAllData();
          this.onWipe();
        }
      });
    }
  }
}
