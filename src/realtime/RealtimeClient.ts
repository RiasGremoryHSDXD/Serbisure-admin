export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'unauthorized';
export type RealtimeEvent = { type: 'sync' | 'chat.changed' | 'chat.typing' | 'presence.changed' | 'booking.changed' | 'notifications.changed'; partner_id?: string; message_id?: string; booking_id?: string; is_typing?: boolean; is_online?: boolean | null; expires_in?: number };
export interface SocketLike {
  onopen: ((event: any) => void) | null;
  onmessage: ((event: any) => void) | null;
  onclose: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  send(data: string): void;
  close(): void;
}

/** First-frame JWT auth avoids putting access tokens in URLs or proxy logs. */
export class RealtimeClient {
  status: RealtimeStatus = 'idle';
  private token: string | null = null;
  private active = true;
  private socket: SocketLike | null = null;
  private generation = 0;
  private attempt = 0;
  private retry?: ReturnType<typeof setTimeout>;
  private authTimeout?: ReturnType<typeof setTimeout>;
  private heartbeat?: ReturnType<typeof setInterval>;
  private lastSeen = 0;
  private events = new Set<(event: RealtimeEvent) => void>();
  private statuses = new Set<(status: RealtimeStatus) => void>();
  private presenceWatches = new Map<symbol, string[]>();
  constructor(private baseUrl: string, private factory: (url: string) => SocketLike = url => new WebSocket(url)) {}
  subscribe(listener: (event: RealtimeEvent) => void) { this.events.add(listener); return () => { this.events.delete(listener); }; }
  subscribeStatus(listener: (status: RealtimeStatus) => void) { this.statuses.add(listener); return () => { this.statuses.delete(listener); }; }
  watchPresence(partnerIds: string[]) {
    const key = Symbol();
    this.presenceWatches.set(key, partnerIds);
    this.sendPresenceWatch();
    return () => { this.presenceWatches.delete(key); this.sendPresenceWatch(); };
  }
  private sendPresenceWatch() {
    if (this.status !== 'connected' || !this.socket) return;
    const partner_ids = [...new Set([...this.presenceWatches.values()].flat())].slice(-100);
    try { this.socket.send(JSON.stringify({ type: 'presence.watch', partner_ids })); } catch { /* Heartbeat reconnects. */ }
  }
  private setStatus(status: RealtimeStatus) { this.status = status; this.statuses.forEach(listener => listener(status)); }
  start(token: string | null) {
    if (token === this.token && this.socket) return;
    this.dispose(); this.token = token; this.attempt = 0;
    if (token && this.active) this.connect(); else this.setStatus('idle');
  }
  stop() { this.dispose(); this.token = null; this.setStatus('idle'); }
  setActive(active: boolean) {
    if (active === this.active) return;
    this.active = active; this.dispose();
    if (active && this.token) this.connect(); else this.setStatus('idle');
  }
  private dispose() {
    this.generation++;
    clearTimeout(this.retry); clearTimeout(this.authTimeout); clearInterval(this.heartbeat);
    this.retry = undefined; this.authTimeout = undefined; this.heartbeat = undefined;
    const socket = this.socket; this.socket = null;
    if (socket) { socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null; socket.close(); }
  }
  private connect() {
    if (!this.token || !this.active) return;
    const generation = ++this.generation;
    const valid = () => generation === this.generation && !!this.token && this.active;
    this.setStatus(this.attempt ? 'reconnecting' : 'connecting');
    const url = this.baseUrl.replace(/\/+$/, '').replace(/^https:/, 'wss:').replace(/^http:/, 'ws:') + '/ws/events/';
    let socket: SocketLike;
    const reconnect = () => {
      if (!valid()) return;
      this.dispose(); this.setStatus('reconnecting');
      const delay = Math.min(30000, 1000 * 2 ** Math.min(this.attempt++, 5)) + Math.floor(Math.random() * 500);
      this.retry = setTimeout(() => this.connect(), delay);
    };
    try { socket = this.factory(url); this.socket = socket; } catch { reconnect(); return; }
    this.authTimeout = setTimeout(reconnect, 8000);
    socket.onopen = () => { if (valid()) socket.send(JSON.stringify({ type: 'authenticate', token: this.token })); };
    socket.onmessage = event => {
      if (!valid()) return;
      let data: any;
      try { data = JSON.parse(event.data); } catch { return; }
      if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;
      this.lastSeen = Date.now();
      if (data.type === 'ready') {
        clearTimeout(this.authTimeout); this.attempt = 0; this.setStatus('connected');
        if (this.presenceWatches.size) this.sendPresenceWatch();
        this.events.forEach(listener => listener({ type: 'sync' }));
        clearInterval(this.heartbeat);
        this.heartbeat = setInterval(() => {
          if (!valid()) return;
          if (Date.now() - this.lastSeen > 65000) { reconnect(); return; }
          try { socket.send(JSON.stringify({ type: 'ping' })); } catch { reconnect(); }
        }, 25000);
      } else if (this.status === 'connected' && ['chat.changed', 'chat.typing', 'presence.changed', 'booking.changed', 'notifications.changed'].includes(data.type)) {
        this.events.forEach(listener => listener(data as RealtimeEvent));
      }
    };
    socket.onclose = event => {
      if (!valid()) return;
      if ([4401, 4403, 4400].includes(event.code)) { this.dispose(); this.setStatus('unauthorized'); }
      else reconnect();
    };
    socket.onerror = reconnect;
  }
}
