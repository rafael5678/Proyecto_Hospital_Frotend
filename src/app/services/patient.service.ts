import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Appointment, AppointmentRequest } from '../models/appointment.model';
import { CupoDisponible, Schedule } from '../models/schedule.model';
import { User } from '../models/user.model';
import { PatientDashboard, PatientProfile } from '../models/patient-profile.model';

@Injectable({ providedIn: 'root' })
export class PatientService {
  private readonly api = `${environment.apiUrl}/patient`;
  private readonly publicApi = environment.apiUrl;

  constructor(private http: HttpClient) {}

  dashboard() {
    return this.http.get<PatientDashboard>(`${this.api}/dashboard`);
  }

  perfil() {
    return this.http.get<PatientProfile>(`${this.api}/profile`);
  }

  actualizarPerfil(data: PatientProfile) {
    return this.http.put<PatientProfile>(`${this.api}/profile`, data);
  }

  listarMedicos() {
    return this.http.get<User[]>(`${this.publicApi}/doctors`);
  }

  horariosMedico(medicoId: number) {
    return this.http.get<Schedule[]>(`${this.publicApi}/doctors/${medicoId}/schedules`);
  }

  cuposMedico(medicoId: number) {
    return this.http.get<CupoDisponible[]>(`${this.publicApi}/doctors/${medicoId}/slots`, {
      params: { limite: 12 }
    });
  }

  agendarCita(data: AppointmentRequest) {
    return this.http.post<Appointment>(`${this.api}/appointments`, data);
  }

  historial() {
    return this.http.get<Appointment[]>(`${this.api}/appointments/history`);
  }

  proximas() {
    return this.http.get<Appointment[]>(`${this.api}/appointments/upcoming`);
  }

  cancelarCita(id: number) {
    return this.http.patch<Appointment>(`${this.api}/appointments/${id}/cancel`, {});
  }
}
