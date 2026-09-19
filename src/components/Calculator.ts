/**
 * Scientific Calculator UI & Secret Double-Tap PIN Unlock Controller
 */

import { MathEvaluator, type AngleMode } from '../math/parser.ts';
import { PinManager } from '../crypto/pin.ts';
import type { LocalStorageManager } from '../db/storage.ts';

export type UnlockSuccessCallback = (pin: string) => void;
export type CreatePinRequestCallback = () => void;

export class CalculatorComponent {
  private container: HTMLElement;
  private mathEvaluator: MathEvaluator;
  private storage: LocalStorageManager;
  private onUnlockSuccess: UnlockSuccessCallback;
  private onCreatePinRequest: CreatePinRequestCallback;

  private currentInput: string = '';
  private historyText: string = '';
  private angleMode: AngleMode = 'DEG';
  private isArmed: boolean = false;
  private lastTitleTapTime: number = 0;
  private armedPinBuffer: string = '';

  constructor(
    container: HTMLElement,
    storage: LocalStorageManager,
    onUnlockSuccess: UnlockSuccessCallback,
    onCreatePinRequest: CreatePinRequestCallback
  ) {
    this.container = container;
    this.storage = storage;
    this.mathEvaluator = new MathEvaluator('DEG');
    this.onUnlockSuccess = onUnlockSuccess;
    this.onCreatePinRequest = onCreatePinRequest;
  }

  public render(): void {
    this.container.innerHTML = `
      <div class="calc-container">
        <div class="calc-header">
          <span class="calc-title" id="calc-header-title">Scientific Calculator</span>
          <span class="calc-mode-indicator" id="calc-angle-indicator">DEG</span>
        </div>

        <div class="calc-display">
          <div class="calc-history-line" id="calc-history">${this.historyText}</div>
          <div class="calc-current-line" id="calc-current">${this.currentInput || '0'}</div>
        </div>

        <div class="calc-keypad">
          <!-- Row 1: Memory & Functions -->
          <button class="calc-btn btn-fn" data-action="deg-rad">DEG</button>
          <button class="calc-btn btn-fn" data-action="mc">MC</button>
          <button class="calc-btn btn-fn" data-action="mr">MR</button>
          <button class="calc-btn btn-fn" data-action="m+">M+</button>
          <button class="calc-btn btn-fn" data-action="m-">M-</button>

          <!-- Row 2: Scientific Functions -->
          <button class="calc-btn btn-fn" data-action="insert" data-val="sin(">sin</button>
          <button class="calc-btn btn-fn" data-action="insert" data-val="cos(">cos</button>
          <button class="calc-btn btn-fn" data-action="insert" data-val="tan(">tan</button>
          <button class="calc-btn btn-fn" data-action="insert" data-val="pi">π</button>
          <button class="calc-btn btn-fn" data-action="insert" data-val="e">e</button>

          <!-- Row 3: Advanced Scientific -->
          <button class="calc-btn btn-fn" data-action="insert" data-val="asin(">asin</button>
          <button class="calc-btn btn-fn" data-action="insert" data-val="acos(">acos</button>
          <button class="calc-btn btn-fn" data-action="insert" data-val="atan(">atan</button>
          <button class="calc-btn btn-fn" data-action="insert" data-val="log(">log</button>
          <button class="calc-btn btn-fn" data-action="insert" data-val="ln(">ln</button>

          <!-- Row 4: Roots & Powers -->
          <button class="calc-btn btn-fn" data-action="insert" data-val="√(">√</button>
          <button class="calc-btn btn-fn" data-action="insert" data-val="^2">x²</button>
          <button class="calc-btn btn-fn" data-action="insert" data-val="^">xʸ</button>
          <button class="calc-btn btn-fn" data-action="insert" data-val="!">n!</button>
          <button class="calc-btn btn-fn" data-action="clear">AC</button>

          <!-- Row 5: Parentheses & Operators -->
          <button class="calc-btn btn-op" data-action="insert" data-val="(">(</button>
          <button class="calc-btn btn-op" data-action="insert" data-val=")">)</button>
          <button class="calc-btn btn-op" data-action="insert" data-val="%">%</button>
          <button class="calc-btn btn-op" data-action="delete">⌫</button>
          <button class="calc-btn btn-op" data-action="insert" data-val="÷">÷</button>

          <!-- Row 6: Numbers 7 8 9 × -->
          <button class="calc-btn" data-action="digit" data-val="7">7</button>
          <button class="calc-btn" data-action="digit" data-val="8">8</button>
          <button class="calc-btn" data-action="digit" data-val="9">9</button>
          <button class="calc-btn btn-op" data-action="insert" data-val="×" style="grid-column: span 2;">×</button>

          <!-- Row 7: Numbers 4 5 6 − -->
          <button class="calc-btn" data-action="digit" data-val="4">4</button>
          <button class="calc-btn" data-action="digit" data-val="5">5</button>
          <button class="calc-btn" data-action="digit" data-val="6">6</button>
          <button class="calc-btn btn-op" data-action="insert" data-val="−" style="grid-column: span 2;">−</button>

          <!-- Row 8: Numbers 1 2 3 + -->
          <button class="calc-btn" data-action="digit" data-val="1">1</button>
          <button class="calc-btn" data-action="digit" data-val="2">2</button>
          <button class="calc-btn" data-action="digit" data-val="3">3</button>
          <button class="calc-btn btn-op" data-action="insert" data-val="+" style="grid-column: span 2;">+</button>

          <!-- Row 9: 0 . = -->
          <button class="calc-btn" data-action="digit" data-val="0" style="grid-column: span 2;">0</button>
          <button class="calc-btn" data-action="digit" data-val=".">.</button>
          <button class="calc-btn btn-accent" data-action="equals" style="grid-column: span 2;">=</button>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    const titleEl = this.container.querySelector('#calc-header-title');

    // Double-tap title gesture (within 500 ms) to arm unlock mode
    if (titleEl) {
      titleEl.addEventListener('click', () => {
        const now = Date.now();
        if (now - this.lastTitleTapTime < 500) {
          // Armed!
          this.isArmed = true;
          this.armedPinBuffer = '';
        }
        this.lastTitleTapTime = now;
      });
    }

    // Keypad listeners
    const buttons = this.container.querySelectorAll('.calc-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const action = target.dataset.action;
        const val = target.dataset.val || '';

        this.handleButtonPress(action, val);
      });
    });
  }

  private async handleButtonPress(action: string | undefined, val: string): Promise<void> {
    if (!action) return;

    // Collect numeric PIN if armed
    if (this.isArmed) {
      if (action === 'digit' && /[0-9]/.test(val)) {
        this.armedPinBuffer += val;
      }
    }

    switch (action) {
      case 'deg-rad':
        this.angleMode = this.angleMode === 'DEG' ? 'RAD' : 'DEG';
        this.mathEvaluator.setAngleMode(this.angleMode);
        const modeEl = this.container.querySelector('#calc-angle-indicator');
        if (modeEl) modeEl.textContent = this.angleMode;
        break;

      case 'clear':
        this.currentInput = '';
        this.historyText = '';
        this.isArmed = false;
        this.armedPinBuffer = '';
        break;

      case 'delete':
        if (this.currentInput.length > 0) {
          this.currentInput = this.currentInput.slice(0, -1);
        }
        break;

      case 'digit':
      case 'insert':
        this.currentInput += val;
        break;

      case 'mc':
        this.mathEvaluator.memoryClear();
        break;

      case 'mr':
        this.currentInput += this.mathEvaluator.getMemory().toString();
        break;

      case 'm+':
        try {
          const res = this.mathEvaluator.evaluate(this.currentInput);
          this.mathEvaluator.memoryAdd(res);
        } catch (e) {}
        break;

      case 'm-':
        try {
          const res = this.mathEvaluator.evaluate(this.currentInput);
          this.mathEvaluator.memorySubtract(res);
        } catch (e) {}
        break;

      case 'equals':
        await this.handleEquals();
        break;
    }

    this.updateDisplay();
  }

  private async handleEquals(): Promise<void> {
    // Check hidden unlock mode first
    if (this.isArmed) {
      const settings = this.storage.getSettings();

      // Escalating lockout delay check
      const lockoutDelay = PinManager.getLockoutDelayMs(settings.failedPinAttempts || 0);
      const timeSinceLastFailed = Date.now() - (settings.lastFailedPinTime || 0);

      if (lockoutDelay > 0 && timeSinceLastFailed < lockoutDelay) {
        // Still in lockout period -> evaluate normally, no hint
        this.isArmed = false;
        this.armedPinBuffer = '';
        this.calculateMath();
        return;
      }

      // Check if PIN has been setup
      if (!settings.pinHash || !settings.pinSalt) {
        // First time arming: prompt user to create PIN!
        this.isArmed = false;
        this.armedPinBuffer = '';
        this.onCreatePinRequest();
        return;
      }

      // Verify PIN hash
      const enteredHash = await PinManager.hashPin(this.armedPinBuffer, settings.pinSalt);

      if (enteredHash === settings.pinHash) {
        // Success! Reset failed counter and open chat
        settings.failedPinAttempts = 0;
        this.storage.saveSettings(settings);

        const pin = this.armedPinBuffer;
        this.isArmed = false;
        this.armedPinBuffer = '';
        this.currentInput = '';
        this.updateDisplay();

        this.onUnlockSuccess(pin);
        return;
      } else {
        // Wrong PIN -> escalate delay counter, clear armed state, calculate normally
        settings.failedPinAttempts = (settings.failedPinAttempts || 0) + 1;
        settings.lastFailedPinTime = Date.now();
        this.storage.saveSettings(settings);

        this.isArmed = false;
        this.armedPinBuffer = '';
      }
    }

    // Normal calculation
    this.calculateMath();
  }

  private calculateMath(): void {
    if (!this.currentInput || this.currentInput.trim() === '') return;

    try {
      const result = this.mathEvaluator.evaluate(this.currentInput);
      this.historyText = `${this.currentInput} =`;

      // Format result nicely
      if (Number.isInteger(result)) {
        this.currentInput = result.toString();
      } else {
        this.currentInput = parseFloat(result.toFixed(8)).toString();
      }
    } catch (err: any) {
      this.historyText = this.currentInput;
      this.currentInput = 'Error';
    }
  }

  private updateDisplay(): void {
    const currentEl = this.container.querySelector('#calc-current');
    const historyEl = this.container.querySelector('#calc-history');

    if (currentEl) currentEl.textContent = this.currentInput || '0';
    if (historyEl) historyEl.textContent = this.historyText;
  }
}
