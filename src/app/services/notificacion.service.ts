import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Notificacion } from '../models/notificacion.model';

@Injectable({ providedIn: 'root' })
export class NotificacionService {
  private http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/notificaciones`;

  listar() {
    return this.http.get<Notificacion[]>(this.api);
  }

  noLeidas() {
    return this.http.get<{ total: number }>(`${this.api}/no-leidas`);
  }

  leer(id: number) {
    return this.http.patch<void>(`${this.api}/${id}/leer`, {});
  }

  leerTodas() {
    return this.http.patch<void>(`${this.api}/leer-todas`, {});
  }
}
