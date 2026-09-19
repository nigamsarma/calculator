/**
 * Main Progressive Web App Controller & Router
 */

import './styles/main.css';
import { LocalStorageManager } from './db/storage.ts';
import { SafetyService } from './services/safety.ts';
import { CalculatorComponent } from './components/Calculator.ts';
import { UnlockModalComponent } from './components/UnlockModal.ts';
import { PairingViewComponent } from './components/PairingView.ts';
import { ChatAppComponent } from './components/ChatApp.ts';
import type { UserSession } from './types/index.ts';

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) || 'https://calculator-chat-backend.workers.dev';

class App {
  private appEl: HTMLElement;
  private storage: LocalStorageManager;
  private currentChatApp: ChatAppComponent | null = null;
  private session: UserSession | null = null;
  private currentPin: string = '';
  private currentRoomId: string = '';

  constructor() {
    this.appEl = document.getElementById('app')!;
    this.storage = new LocalStorageManager();
  }

  public async start(): Promise<void> {
    await this.storage.init();

    // Register Service Worker for PWA & Disguised Push
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
    }

    // Initialize Safety Panic Exit & Auto-Lock
    SafetyService.init(() => this.lockApp());

    // Render Calculator (default view)
    this.showCalculator();
  }

  public showCalculator(): void {
    if (this.currentChatApp) {
      this.currentChatApp.destroy();
      this.currentChatApp = null;
    }

    const calcComp = new CalculatorComponent(
      this.appEl,
      this.storage,
      (pin) => this.handleUnlockSuccess(pin),
      () => this.handleCreatePinRequest()
    );
    calcComp.render();
  }

  private handleCreatePinRequest(): void {
    new UnlockModalComponent(this.appEl, this.storage, (pin) => {
      this.handleUnlockSuccess(pin);
    }).render();
  }

  private async handleUnlockSuccess(pin: string): Promise<void> {
    this.currentPin = pin;

    // Check mock/session user state
    if (!this.session) {
      this.session = {
        token: 'dev-demo-session-token',
        userId: 'user_' + Math.random().toString(36).substring(2, 8),
        email: 'user@example.com',
        name: 'Consenting User'
      };
    }

    // Check existing paired rooms
    const rooms = await this.storage.getRooms();
    if (rooms.length > 0) {
      this.currentRoomId = rooms[0].roomId;
      this.showChat(this.currentRoomId);
    } else {
      this.showPairing();
    }
  }

  public showPairing(): void {
    const pairingComp = new PairingViewComponent(
      this.appEl,
      BACKEND_URL,
      this.session?.token || '',
      async (roomId) => {
        await this.storage.saveRoom({ roomId, createdTime: Date.now() });
        this.currentRoomId = roomId;
        this.showChat(roomId);
      }
    );
    pairingComp.render();
  }

  public async showChat(roomId: string): Promise<void> {
    if (this.currentChatApp) {
      this.currentChatApp.destroy();
    }

    this.currentChatApp = new ChatAppComponent(
      this.appEl,
      this.storage,
      BACKEND_URL,
      this.session!,
      roomId,
      this.currentPin,
      () => this.lockApp()
    );
    await this.currentChatApp.init();
  }

  public lockApp(): void {
    this.currentPin = '';
    this.showCalculator();
  }
}

// Bootstrap app on DOMReady
window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.start();
});
