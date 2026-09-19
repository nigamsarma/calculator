/**
 * First-Time PIN Setup Modal Prompt
 */

import { PinManager } from '../crypto/pin.ts';
import type { LocalStorageManager } from '../db/storage.ts';

export class UnlockModalComponent {
  private container: HTMLElement;
  private storage: LocalStorageManager;
  private onComplete: (pin: string) => void;

  constructor(container: HTMLElement, storage: LocalStorageManager, onComplete: (pin: string) => void) {
    this.container = container;
    this.storage = storage;
    this.onComplete = onComplete;
  }

  public render(): void {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-card">
        <div class="modal-title">Set Up Access PIN</div>
        <div class="modal-subtitle">Create a secret numeric passcode (minimum 6 digits). This PIN encrypts your messages and unlocks the app.</div>

        <input type="password" id="modal-pin-input" class="modal-input" placeholder="••••••" maxlength="12" pattern="[0-9]*" inputmode="numeric" />
        <input type="password" id="modal-pin-confirm" class="modal-input" placeholder="Confirm PIN" maxlength="12" pattern="[0-9]*" inputmode="numeric" />

        <div id="modal-error" style="color: #ff3b30; font-size: 0.8rem; text-align: center; display: none;"></div>

        <button id="modal-save-btn" class="modal-btn">Save Passcode</button>
      </div>
    `;

    this.container.appendChild(modal);

    const pinInput = modal.querySelector('#modal-pin-input') as HTMLInputElement;
    const confirmInput = modal.querySelector('#modal-pin-confirm') as HTMLInputElement;
    const saveBtn = modal.querySelector('#modal-save-btn') as HTMLButtonElement;
    const errorEl = modal.querySelector('#modal-error') as HTMLElement;

    saveBtn.addEventListener('click', async () => {
      const pin = pinInput.value.trim();
      const confirmPin = confirmInput.value.trim();

      if (pin.length < 6 || !/^\d+$/.test(pin)) {
        errorEl.textContent = 'PIN must be at least 6 numeric digits.';
        errorEl.style.display = 'block';
        return;
      }

      if (pin !== confirmPin) {
        errorEl.textContent = 'PINs do not match. Please try again.';
        errorEl.style.display = 'block';
        return;
      }

      // Hash PIN with PBKDF2
      const salt = PinManager.generateSalt();
      const pinHash = await PinManager.hashPin(pin, salt);

      const settings = this.storage.getSettings();
      settings.pinSalt = salt;
      settings.pinHash = pinHash;
      settings.failedPinAttempts = 0;
      this.storage.saveSettings(settings);

      modal.remove();
      this.onComplete(pin);
    });
  }
}
