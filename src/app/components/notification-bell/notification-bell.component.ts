import { Component, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { NotificationService } from '../../services/notification.service';
import { LiveService } from '../../services/live.service';
import { Notification } from '../../models/notification.model';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.css'
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  theme = input<'paciente' | 'medico'>('paciente');
  private notifications = inject(NotificationService);
  readonly live = inject(LiveService);
  open = signal(false);
  items = signal<Notification[]>([]);
  unread = signal(0);
  justArrived = signal(false);
  private timer: ReturnType<typeof setInterval> | null = null;
  private pulse: ReturnType<typeof setTimeout> | null = null;
  private stopWatch: (() => void) | null = null;

  ngOnInit() {
    this.load();
    this.timer = setInterval(() => this.load(), 25000);
    this.stopWatch = this.live.watch(() => this.onLive());
    if (typeof document !== 'undefined') {
      document.addEventListener('click', this.closeWhenClickingOutside);
    }
  }

  ngOnDestroy() {
    this.stopWatch?.();
    if (this.timer) clearInterval(this.timer);
    if (this.pulse) clearTimeout(this.pulse);
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', this.closeWhenClickingOutside);
    }
  }

  private closeWhenClickingOutside = () => {
    if (this.open()) this.open.set(false);
  };

  load() {
    this.notifications.list().subscribe({
      next: rows => this.items.set(rows),
      error: () => this.items.set([])
    });
    this.notifications.unreadCount().subscribe({
      next: row => this.unread.set(row.total),
      error: () => this.unread.set(0)
    });
  }

  private onLive() {
    this.justArrived.set(true);
    this.load();
    if (this.pulse) clearTimeout(this.pulse);
    this.pulse = setTimeout(() => this.justArrived.set(false), 1400);
  }

  toggle() {
    this.open.update(value => !value);
    if (this.open()) this.load();
  }

  markOne(notice: Notification) {
    if (notice.leida) return;
    this.notifications.markRead(notice.id).subscribe({ next: () => this.load() });
  }

  markAll() {
    this.notifications.markAllRead().subscribe({ next: () => this.load() });
  }

  horaColombia(iso?: string): string {
    if (!iso) return '';
    const conZona = /[zZ]|[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`;
    const fecha = new Date(conZona);
    if (Number.isNaN(fecha.getTime())) return iso;
    return fecha.toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      day: 'numeric',
      month: 'numeric',
      year: '2-digit',
      hour: 'numeric',
      minute: '2-digit'
    });
  }
}
