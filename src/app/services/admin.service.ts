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

  listUsers() {
    return this.http.get<User[]>(`${this.api}/users`);
  }

  createUser(data: UserRequest) {
    return this.http.post<User>(`${this.api}/users`, data);
  }

  updateUser(id: number, data: UserRequest) {
    return this.http.put<User>(`${this.api}/users/${id}`, data);
  }

  deactivateUser(id: number) {
    return this.http.delete(`${this.api}/users/${id}`);
  }

  setActive(id: number, activo: boolean) {
    return this.http.patch<User>(`${this.api}/users/${id}/estado`, {}, { params: { activo } });
  }

  resetPassword(id: number, nuevaClave: string, claveAdmin: string) {
    return this.http.patch<{ mensaje: string }>(`${this.api}/users/${id}/password`, { nuevaClave, claveAdmin });
  }

  pingAssistant() {
    return this.http.post<{ operativo: string; modelo: string; detalle: string }>(`${this.api}/ai-ping`, {});
  }

  listDoctors() {
    return this.http.get<User[]>(`${this.api}/doctors`);
  }

  createDoctor(data: UserRequest) {
    return this.http.post<User>(`${this.api}/doctors`, data);
  }

  updateDoctor(id: number, data: UserRequest) {
    return this.http.put<User>(`${this.api}/doctors/${id}`, data);
  }

  superviseAppointments() {
    return this.http.get<Appointment[]>(`${this.api}/appointments`);
  }

  rescheduleAppointment(id: number, fechaHora: string, motivo: string) {
    return this.http.patch<RescheduleAppointmentResponse>(`${this.api}/appointments/${id}/reschedule`, { fechaHora, motivo });
  }

  reports(anio = new Date().getFullYear()) {
    return this.http.get<Report>(`${this.api}/reports`, { params: { anio } });
  }

  aiMetrics() {
    return this.http.get<AiMetrics>(`${this.api}/ai-metrics`);
  }
}
