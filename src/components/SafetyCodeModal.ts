/**
 * 6-Digit Safety Code Verification Modal Component
 */

export class SafetyCodeModalComponent {
  private container: HTMLElement;
  private safetyCode: string;

  constructor(container: HTMLElement, safetyCode: string) {
    this.container = container;
    this.safetyCode = safetyCode;
  }

  public render(): void {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-card">
        <div class="modal-title">Verification Safety Code</div>
        <div class="modal-subtitle">Compare this 6-digit code with your partner in person or via another secure channel to verify end-to-end encryption.</div>

        <div style="font-size: 2.2rem; font-weight: 700; letter-spacing: 6px; color: var(--text-accent); text-align: center; margin: 16px 0; font-family: monospace;">
          ${this.safetyCode}
        </div>

        <div style="font-size: 0.8rem; color: var(--text-muted); text-align: center;">
          If the codes on both devices match, your conversation is 100% private and protected against man-in-the-middle attacks.
        </div>

        <button id="safety-modal-close" class="modal-btn" style="margin-top: 12px;">Verified & Close</button>
      </div>
    `;

    this.container.appendChild(modal);

    const closeBtn = modal.querySelector('#safety-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => modal.remove());
    }
  }
}
