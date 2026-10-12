import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Cita } from '../models/cita.model';
import { Horario, HorarioRequest } from '../models/horario.model';
import { PacientePerfil } from '../models/paciente-perfil.model';

export interface MedicoDashboard {
  totalCitas: number;
  citasPendientes: number;
  citasAceptadas: number;
  citasHoy: number;
  horariosActivos: number;
}

export interface MedicoPerfil {
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
export class MedicoService {
  private readonly api = `${environment.apiUrl}/medico`;

  constructor(private http: HttpClient) {}

  dashboard() {
    return this.http.get<MedicoDashboard>(`${this.api}/dashboard`);
  }

  perfil() {
    return this.http.get<MedicoPerfil>(`${this.api}/perfil`);
  }

  misCitas() {
    return this.http.get<Cita[]>(`${this.api}/citas`);
  }

  aceptar(id: number) {
    return this.http.patch<Cita>(`${this.api}/citas/${id}/aceptar`, {});
  }

  rechazar(id: number) {
    return this.http.patch<Cita>(`${this.api}/citas/${id}/rechazar`, {});
  }

  verPaciente(citaId: number) {
    return this.http.get<PacientePerfil>(`${this.api}/citas/${citaId}/paciente`);
  }

  historialPaciente(citaId: number) {
    return this.http.get<Cita[]>(`${this.api}/citas/${citaId}/historial-paciente`);
  }

  misHorarios() {
    return this.http.get<Horario[]>(`${this.api}/horarios`);
  }

  crearHorario(data: HorarioRequest) {
    return this.http.post<Horario>(`${this.api}/horarios`, data);
  }

  eliminarHorario(id: number) {
    return this.http.delete(`${this.api}/horarios/${id}`);
  }
}
