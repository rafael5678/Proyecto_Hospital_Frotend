import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

const SESSION_KEY = 'hospy_session';

/** Extra ping for the bell. The 25-second refresh stays, so a closed socket changes nothing. */
@Injectable({ providedIn: 'root' })
export class LiveService {
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<() => void>();

  watch(listener: () => void): () => void {
    this.listeners.add(listener);
    this.connect();
    return () => this.listeners.delete(listener);
  }

  private connect() {
    if (this.socket || this.listeners.size === 0) return;
    const token = this.token();
    if (!token) return;
    const http = environment.apiUrl.replace(/\/api\/?$/, '');
    const ws = http.replace(/^http/, 'ws');
    try {
      const socket = new WebSocket(`${ws}/api/live?token=${encodeURIComponent(token)}`);
      this.socket = socket;
      socket.onmessage = () => this.listeners.forEach(listener => listener());
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        if (this.socket === socket) this.socket = null;
      };
    } catch {
      this.socket = null;
    }
  }

  private token(): string | null {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return (JSON.parse(raw) as { token?: string }).token ?? null;
    } catch {
      return null;
    }
  }
}
