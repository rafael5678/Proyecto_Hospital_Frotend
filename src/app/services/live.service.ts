import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

const SESSION_KEY = 'hospy_session';

/** Keeps one socket open. If it drops, the bell still refreshes on its own timer. */
@Injectable({ providedIn: 'root' })
export class LiveService {
  readonly connected = signal(false);
  private socket: WebSocket | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private readonly listeners = new Set<() => void>();

  watch(listener: () => void): () => void {
    this.listeners.add(listener);
    this.connect();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.disconnect();
    };
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
      socket.onopen = () => this.connected.set(true);
      socket.onmessage = () => this.listeners.forEach(listener => listener());
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        if (this.socket !== socket) return;
        this.socket = null;
        this.connected.set(false);
        this.schedule();
      };
    } catch {
      this.socket = null;
      this.connected.set(false);
      this.schedule();
    }
  }

  private schedule() {
    if (this.retry || this.listeners.size === 0) return;
    this.retry = setTimeout(() => {
      this.retry = null;
      this.connect();
    }, 3000);
  }

  private disconnect() {
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
    this.socket?.close();
    this.socket = null;
    this.connected.set(false);
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
