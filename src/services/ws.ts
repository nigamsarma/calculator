/**
 * WebSocket Connection Client for Durable Object Chat Room
 */

export type WebSocketMessageCallback = (msg: any) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private onMessageCallback: WebSocketMessageCallback;
  private isConnected: boolean = false;
  private reconnectTimer: any = null;

  constructor(backendUrl: string, roomId: string, userId: string, onMessage: WebSocketMessageCallback) {
    const wsProto = backendUrl.startsWith('https') ? 'wss' : 'ws';
    const host = backendUrl.replace(/^https?:\/\//, '');
    this.url = `${wsProto}://${host}/api/ws?roomId=${encodeURIComponent(roomId)}&userId=${encodeURIComponent(userId)}`;
    this.onMessageCallback = onMessage;
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.onMessageCallback({ type: 'ws_connected' });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.onMessageCallback(data);
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.onMessageCallback({ type: 'ws_disconnected' });
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket error:', err);
      };
    } catch (e) {
      this.scheduleReconnect();
    }
  }

  public send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  public close(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 3000);
  }
}
