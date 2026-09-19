/**
 * Pairing View Component (Room ID + 16-char invite key creation & join)
 */

export type PairingCompleteCallback = (roomId: string) => void;

export class PairingViewComponent {
  private container: HTMLElement;
  private backendUrl: string;
  private token: string;
  private onComplete: PairingCompleteCallback;

  constructor(container: HTMLElement, backendUrl: string, token: string, onComplete: PairingCompleteCallback) {
    this.container = container;
    this.backendUrl = backendUrl;
    this.token = token;
    this.onComplete = onComplete;
  }

  public render(): void {
    this.container.innerHTML = `
      <div class="modal-card" style="margin: 32px auto; max-width: 440px;">
        <div class="modal-title">Device Pairing</div>
        <div class="modal-subtitle">Connect with your partner using a 1-to-1 encrypted room code.</div>

        <div style="display: flex; gap: 8px; margin-top: 12px;">
          <button id="tab-create-btn" class="modal-btn" style="flex: 1; background-color: var(--chat-sent);">Create Pairing</button>
          <button id="tab-join-btn" class="modal-btn" style="flex: 1; background-color: var(--bg-tertiary);">Join Room</button>
        </div>

        <!-- Create Section -->
        <div id="section-create" style="display: flex; flex-direction: column; gap: 12px; margin-top: 16px;">
          <div style="font-size: 0.85rem; color: var(--text-muted);">Generate a one-time invite key (valid for 24 hours).</div>
          <button id="btn-generate-invite" class="modal-btn">Generate Room Code</button>

          <div id="create-result" style="display: none; background: var(--bg-primary); padding: 16px; border-radius: 12px; border: 1px solid var(--border-color); margin-top: 12px;">
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 4px;">ROOM ID</div>
            <div id="res-room-id" style="font-size: 1.4rem; font-weight: 700; color: var(--text-accent); letter-spacing: 2px;"></div>
            
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 12px; margin-bottom: 4px;">ONE-TIME INVITE KEY</div>
            <div id="res-invite-key" style="font-size: 1.1rem; font-family: monospace; color: var(--text-main); word-break: break-all; letter-spacing: 1px;"></div>

            <button id="btn-start-room" class="modal-btn" style="margin-top: 16px; width: 100%;">Enter Room</button>
          </div>
        </div>

        <!-- Join Section -->
        <div id="section-join" style="display: none; flex-direction: column; gap: 12px; margin-top: 16px;">
          <div style="font-size: 0.85rem; color: var(--text-muted);">Enter the Room ID and 16-character invite key provided by your partner.</div>

          <input type="text" id="join-room-id" class="modal-input" placeholder="Room ID (e.g. A1B2C3D4)" style="text-transform: uppercase;" />
          <input type="text" id="join-invite-key" class="modal-input" placeholder="16-Character Invite Key" />

          <div id="join-error" style="color: #ff3b30; font-size: 0.8rem; text-align: center; display: none;"></div>

          <button id="btn-join-submit" class="modal-btn">Connect & Pair</button>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    const tabCreate = this.container.querySelector('#tab-create-btn') as HTMLButtonElement;
    const tabJoin = this.container.querySelector('#tab-join-btn') as HTMLButtonElement;
    const secCreate = this.container.querySelector('#section-create') as HTMLElement;
    const secJoin = this.container.querySelector('#section-join') as HTMLElement;

    tabCreate.addEventListener('click', () => {
      tabCreate.style.backgroundColor = 'var(--chat-sent)';
      tabJoin.style.backgroundColor = 'var(--bg-tertiary)';
      secCreate.style.display = 'flex';
      secJoin.style.display = 'none';
    });

    tabJoin.addEventListener('click', () => {
      tabJoin.style.backgroundColor = 'var(--chat-sent)';
      tabCreate.style.backgroundColor = 'var(--bg-tertiary)';
      secJoin.style.display = 'flex';
      secCreate.style.display = 'none';
    });

    // Create Invite
    const btnGen = this.container.querySelector('#btn-generate-invite') as HTMLButtonElement;
    const resDiv = this.container.querySelector('#create-result') as HTMLElement;
    const resRoomId = this.container.querySelector('#res-room-id') as HTMLElement;
    const resInviteKey = this.container.querySelector('#res-invite-key') as HTMLElement;
    const btnStart = this.container.querySelector('#btn-start-room') as HTMLButtonElement;

    let createdRoomId = '';

    btnGen.addEventListener('click', async () => {
      try {
        const res = await fetch(`${this.backendUrl}/api/pairing/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`
          }
        });
        const data = await res.json();
        if (data.roomId) {
          createdRoomId = data.roomId;
          resRoomId.textContent = data.roomId;
          resInviteKey.textContent = data.inviteKey;
          resDiv.style.display = 'block';
          btnGen.style.display = 'none';
        }
      } catch (e) {
        alert('Failed to create pairing room');
      }
    });

    btnStart.addEventListener('click', () => {
      if (createdRoomId) {
        this.onComplete(createdRoomId);
      }
    });

    // Join Invite
    const joinRoomIdInput = this.container.querySelector('#join-room-id') as HTMLInputElement;
    const joinKeyInput = this.container.querySelector('#join-invite-key') as HTMLInputElement;
    const btnJoinSubmit = this.container.querySelector('#btn-join-submit') as HTMLButtonElement;
    const joinErr = this.container.querySelector('#join-error') as HTMLElement;

    btnJoinSubmit.addEventListener('click', async () => {
      const roomId = joinRoomIdInput.value.trim().toUpperCase();
      const inviteKey = joinKeyInput.value.trim();

      if (!roomId || !inviteKey) {
        joinErr.textContent = 'Please enter both Room ID and Invite Key.';
        joinErr.style.display = 'block';
        return;
      }

      try {
        const res = await fetch(`${this.backendUrl}/api/pairing/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`
          },
          body: JSON.stringify({ roomId, inviteKey })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          this.onComplete(roomId);
        } else {
          joinErr.textContent = data.error || 'Pairing failed. Check key and try again.';
          joinErr.style.display = 'block';
        }
      } catch (e) {
        joinErr.textContent = 'Network error while joining room.';
        joinErr.style.display = 'block';
      }
    });
  }
}
