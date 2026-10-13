import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Appointment, RescheduleAppointmentResponse } from '../models/appointment.model';
import { Report } from '../models/report.model';
import { User, UserRequest } from '../models/user.model';
import { AiMetrics } from '../models/ai.model';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) {}

  listarUsuarios() {
    return this.http.get<User[]>(`${this.api}/users`);
  }

  crearUsuario(data: UserRequest) {
    return this.http.post<User>(`${this.api}/users`, data);
  }

  actualizarUsuario(id: number, data: UserRequest) {
    return this.http.put<User>(`${this.api}/users/${id}`, data);
  }

  desactivarUsuario(id: number) {
    return this.http.delete(`${this.api}/users/${id}`);
  }

  cambiarEstado(id: number, activo: boolean) {
    return this.http.patch<User>(`${this.api}/users/${id}/estado`, {}, { params: { activo } });
  }

  listarMedicos() {
    return this.http.get<User[]>(`${this.api}/doctors`);
  }

  crearMedico(data: UserRequest) {
    return this.http.post<User>(`${this.api}/doctors`, data);
  }

  actualizarMedico(id: number, data: UserRequest) {
    return this.http.put<User>(`${this.api}/doctors/${id}`, data);
  }

  supervisarCitas() {
    return this.http.get<Appointment[]>(`${this.api}/appointments`);
  }

  reprogramarCita(id: number, fechaHora: string, motivo: string) {
    return this.http.patch<RescheduleAppointmentResponse>(`${this.api}/appointments/${id}/reschedule`, { fechaHora, motivo });
  }

  reportes(anio = new Date().getFullYear()) {
    return this.http.get<Report>(`${this.api}/reports`, { params: { anio } });
  }

  aiMetricas() {
    return this.http.get<AiMetrics>(`${this.api}/ai-metrics`);
  }
}
