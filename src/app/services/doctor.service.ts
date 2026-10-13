import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Appointment } from '../models/appointment.model';
import { Schedule, ScheduleRequest } from '../models/schedule.model';
import { PatientProfile } from '../models/patient-profile.model';

export interface DoctorDashboard {
  totalCitas: number;
  citasPendientes: number;
  citasAceptadas: number;
  citasHoy: number;
  horariosActivos: number;
}

export interface DoctorProfile {
  id: number;
  nombre: string;
  email: string;
  telefono?: string;
  especialidad?: string;
  numeroLicencia?: string;
  consultorio?: string;
  anosExperiencia?: number;
  biografia?: string;
}

@Injectable({ providedIn: 'root' })
export class DoctorService {
  private readonly api = `${environment.apiUrl}/doctor`;

  constructor(private http: HttpClient) {}

  dashboard() {
    return this.http.get<DoctorDashboard>(`${this.api}/dashboard`);
  }

  perfil() {
    return this.http.get<DoctorProfile>(`${this.api}/profile`);
  }

  misCitas() {
    return this.http.get<Appointment[]>(`${this.api}/appointments`);
  }

  aceptar(id: number) {
    return this.http.patch<Appointment>(`${this.api}/appointments/${id}/accept`, {});
  }

  rechazar(id: number) {
    return this.http.patch<Appointment>(`${this.api}/appointments/${id}/reject`, {});
  }

  verPaciente(citaId: number) {
    return this.http.get<PatientProfile>(`${this.api}/appointments/${citaId}/patient`);
  }

  historialPaciente(citaId: number) {
    return this.http.get<Appointment[]>(`${this.api}/appointments/${citaId}/patient-history`);
  }

  misHorarios() {
    return this.http.get<Schedule[]>(`${this.api}/schedules`);
  }

  crearHorario(data: ScheduleRequest) {
    return this.http.post<Schedule>(`${this.api}/schedules`, data);
  }

  eliminarHorario(id: number) {
    return this.http.delete(`${this.api}/schedules/${id}`);
  }
}
