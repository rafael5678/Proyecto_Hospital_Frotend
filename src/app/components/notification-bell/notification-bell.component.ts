import { Component, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NotificationService } from '../../services/notification.service';
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
  abierta = signal(false);
  items = signal<Notification[]>([]);
  noLeidas = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.cargar();
    this.timer = setInterval(() => this.cargar(), 25000);
    if (typeof document !== 'undefined') {
      document.addEventListener('click', this.cerrarSiAfuera);
    }
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', this.cerrarSiAfuera);
    }
  }

  private cerrarSiAfuera = () => {
    if (this.abierta()) this.abierta.set(false);
  };

  cargar() {
    this.svc.listar().subscribe({
      next: n => this.items.set(n),
      error: () => this.items.set([])
    });
    this.svc.noLeidas().subscribe({
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
    this.svc.leer(n.id).subscribe({ next: () => this.cargar() });
  }

  leerTodas() {
    this.svc.leerTodas().subscribe({ next: () => this.cargar() });
  }
}
