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

  profile() {
    return this.http.get<DoctorProfile>(`${this.api}/profile`);
  }

  myAppointments() {
    return this.http.get<Appointment[]>(`${this.api}/appointments`);
  }

  accept(id: number) {
    return this.http.patch<Appointment>(`${this.api}/appointments/${id}/accept`, {});
  }

  reject(id: number) {
    return this.http.patch<Appointment>(`${this.api}/appointments/${id}/reject`, {});
  }

  viewPatient(citaId: number) {
    return this.http.get<PatientProfile>(`${this.api}/appointments/${citaId}/patient`);
  }

  patientHistory(citaId: number) {
    return this.http.get<Appointment[]>(`${this.api}/appointments/${citaId}/patient-history`);
  }

  sendPrescription(citaId: number, datos: { resumen?: string; medicamentos?: string; cuidados?: string }) {
    return this.http.post<{ mensaje: string }>(`${this.api}/appointments/${citaId}/indicacion`, datos);
  }

  mySchedules() {
    return this.http.get<Schedule[]>(`${this.api}/schedules`);
  }

  createSchedule(data: ScheduleRequest) {
    return this.http.post<Schedule>(`${this.api}/schedules`, data);
  }

  deleteSchedule(id: number) {
    return this.http.delete(`${this.api}/schedules/${id}`);
  }
}
