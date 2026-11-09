import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Notification } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/notifications`;

  list() {
    return this.http.get<Notification[]>(this.api);
  }

  unreadCount() {
    return this.http.get<{ total: number }>(`${this.api}/unread`);
  }

  markRead(id: number) {
    return this.http.patch<void>(`${this.api}/${id}/read`, {});
  }

  markAllRead() {
    return this.http.patch<void>(`${this.api}/read-all`, {});

/** HTTP calls for the in-app bell. */
  }
}
