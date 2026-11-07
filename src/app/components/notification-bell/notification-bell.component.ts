import { Component, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NotificationService } from '../../services/notification.service';
import { LiveService } from '../../services/live.service';
import { Notification } from '../../models/notification.model';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.css'
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  theme = input<'paciente' | 'medico'>('paciente');
  private svc = inject(NotificationService);
  private live = inject(LiveService);
  abierta = signal(false);
  items = signal<Notification[]>([]);
  noLeidas = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;
  private dejarAviso: (() => void) | null = null;

  ngOnInit() {
    this.cargar();
    this.timer = setInterval(() => this.cargar(), 25000);
    this.dejarAviso = this.live.watch(() => this.cargar());
    if (typeof document !== 'undefined') {
      document.addEventListener('click', this.cerrarSiAfuera);
    }
  }

  ngOnDestroy() {
    this.dejarAviso?.();
    if (this.timer) clearInterval(this.timer);
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', this.cerrarSiAfuera);
    }
  }

  private cerrarSiAfuera = () => {
    if (this.abierta()) this.abierta.set(false);
  };

  cargar() {
    this.svc.list().subscribe({
      next: n => this.items.set(n),
      error: () => this.items.set([])
    });
    this.svc.unreadCount().subscribe({
      next: r => this.noLeidas.set(r.total),
      error: () => this.noLeidas.set(0)
    });
  }

  toggle() {
    this.abierta.set(!this.abierta());
    if (this.abierta()) this.cargar();
  }

  leer(n: Notification) {
    if (n.leida) return;
    this.svc.markRead(n.id).subscribe({ next: () => this.cargar() });
  }

  leerTodas() {
    this.svc.markAllRead().subscribe({ next: () => this.cargar() });
  }
}
