import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Notification } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/notifications`;

  listar() {
    return this.http.get<Notification[]>(this.api);
  }

  noLeidas() {
    return this.http.get<{ total: number }>(`${this.api}/unread`);
  }

  leer(id: number) {
    return this.http.patch<void>(`${this.api}/${id}/read`, {});
  }

  leerTodas() {
    return this.http.patch<void>(`${this.api}/read-all`, {});
  }
}
