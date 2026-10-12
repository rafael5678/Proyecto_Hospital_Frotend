import { Component, computed, inject, input, OnDestroy, OnInit, signal } from '@angular/core';
import { InactivityService } from '../../services/inactivity.service';
import { INACTIVITY_TIMEOUT_MS } from '../../services/inactivity.config';

@Component({
  selector: 'app-session-timeout',
  standalone: true,
  template: `
    <span
      class="idle-badge"
      [class.theme-medico]="theme() === 'medico'"
      [class.warning]="seconds() <= warningAt()"
    >
      ⏱ Cierre automático en {{ label() }}
    </span>
  `,
  styles: `
    .idle-badge {
      display: inline-block;
      font-size: 0.8rem;
      font-weight: 600;
      color: #7c3aed;
      background: #ede9fe;
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      margin-top: 0.25rem;
    }
    .idle-badge.theme-medico { color: #0369a1; background: #e0f2fe; }
    .idle-badge.warning { color: #b91c1c; background: #fee2e2; }
  `
})
export class SessionTimeoutComponent implements OnInit, OnDestroy {
  rol = input.required<'ADMIN' | 'MEDICO'>();
  theme = input<'admin' | 'medico'>('admin');

  private inactivity = inject(InactivityService);
  seconds = signal(0);

  warningAt = computed(() => this.rol() === 'ADMIN' ? 60 : 60);

  label = computed(() => {
    const s = this.seconds();
    if (s >= 60) {
      const m = Math.floor(s / 60);
      const r = s % 60;
      return r > 0 ? `${m}m ${r}s` : `${m}m`;
    }
    return `${s}s`;
  });

  ngOnInit(): void {
    const ms = this.rol() === 'ADMIN'
      ? INACTIVITY_TIMEOUT_MS.ADMIN
      : INACTIVITY_TIMEOUT_MS.MEDICO;

    this.inactivity.start(ms, this.rol(), sec => this.seconds.set(sec));
    this.seconds.set(Math.ceil(ms / 1000));
  }

  ngOnDestroy(): void {
    this.inactivity.stop();
  }
}
