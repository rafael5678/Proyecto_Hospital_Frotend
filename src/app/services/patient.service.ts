import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Appointment, AppointmentRequest } from '../models/appointment.model';
import { CupoDisponible, Schedule } from '../models/schedule.model';
import { User } from '../models/user.model';
import { PatientDashboard, PatientProfile } from '../models/patient-profile.model';

/** HTTP calls for the patient portal. */
@Injectable({ providedIn: 'root' })
export class PatientService {
  private readonly api = `${environment.apiUrl}/patient`;
  private readonly publicApi = environment.apiUrl;

  constructor(private http: HttpClient) {}

  dashboard() {
    return this.http.get<PatientDashboard>(`${this.api}/dashboard`);
  }

  profile() {
    return this.http.get<PatientProfile>(`${this.api}/profile`);
  }

  updateProfile(data: PatientProfile) {
    return this.http.put<PatientProfile>(`${this.api}/profile`, data);
  }

  listDoctors() {
    return this.http.get<User[]>(`${this.publicApi}/doctors`);
  }

  doctorSchedules(medicoId: number) {
    return this.http.get<Schedule[]>(`${this.publicApi}/doctors/${medicoId}/schedules`);
  }

  doctorSlots(medicoId: number) {
    return this.http.get<CupoDisponible[]>(`${this.publicApi}/doctors/${medicoId}/slots`, {
      params: { limite: 12 }
    });
  }

  bookAppointment(data: AppointmentRequest) {
    return this.http.post<Appointment>(`${this.api}/appointments`, data);
  }

  history() {
    return this.http.get<Appointment[]>(`${this.api}/appointments/history`);
  }

  upcoming() {
    return this.http.get<Appointment[]>(`${this.api}/appointments/upcoming`);
  }

  cancelAppointment(id: number) {
    return this.http.patch<Appointment>(`${this.api}/appointments/${id}/cancel`, {});

  }
}
