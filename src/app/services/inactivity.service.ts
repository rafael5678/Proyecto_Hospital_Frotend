import { Injectable, Injector, inject } from '@angular/core';
import { AuthService } from './auth.service';

export type InactivityRol = 'ADMIN' | 'MEDICO';

/**
 * Control de inactividad. Usa Injector para evitar dependencia circular con AuthService.
 */
@Injectable({ providedIn: 'root' })
export class InactivityService {
  private readonly injector = inject(Injector);

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private durationMs = 0;
  private lastActivity = 0;
  private rol: InactivityRol | null = null;
  private onTick: ((secondsLeft: number) => void) | null = null;

  private readonly handler = () => this.touch();

  private readonly events = [
    'mousedown',
    'keydown',
    'keyup',
    'click',
    'touchstart',
    'scroll',
    'wheel',
    'pointerdown',
    'input'
  ] as const;

  start(durationMs: number, rol: InactivityRol, onTick?: (secondsLeft: number) => void): void {
    this.stop();
    this.durationMs = durationMs;
    this.rol = rol;
    this.onTick = onTick ?? null;
    this.lastActivity = Date.now();

    this.events.forEach(e =>
      window.addEventListener(e, this.handler, { capture: true, passive: true })
    );

    this.intervalId = setInterval(() => this.check(), 500);
    this.check();
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.events.forEach(e =>
      window.removeEventListener(e, this.handler, { capture: true })
    );
    this.rol = null;
    this.onTick = null;
  }

  private touch(): void {
    this.lastActivity = Date.now();
  }

  private check(): void {
    if (!this.rol || this.durationMs <= 0) return;

    const idle = Date.now() - this.lastActivity;
    const left = Math.max(0, Math.ceil((this.durationMs - idle) / 1000));
    this.onTick?.(left);

    if (idle >= this.durationMs) {
      const rol = this.rol;
      this.stop();
      this.injector.get(AuthService).logoutPorInactividad(rol);
    }
  }
}
