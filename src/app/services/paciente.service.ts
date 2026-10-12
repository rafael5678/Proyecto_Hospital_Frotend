import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Cita, CitaRequest } from '../models/cita.model';
import { Horario } from '../models/horario.model';
import { Usuario } from '../models/usuario.model';
import { PacienteDashboard, PacientePerfil } from '../models/paciente-perfil.model';

@Injectable({ providedIn: 'root' })
export class PacienteService {
  private readonly api = `${environment.apiUrl}/paciente`;
  private readonly publicApi = environment.apiUrl;

  constructor(private http: HttpClient) {}

  dashboard() {
    return this.http.get<PacienteDashboard>(`${this.api}/dashboard`);
  }

  perfil() {
    return this.http.get<PacientePerfil>(`${this.api}/perfil`);
  }

  actualizarPerfil(data: PacientePerfil) {
    return this.http.put<PacientePerfil>(`${this.api}/perfil`, data);
  }

  listarMedicos() {
    return this.http.get<Usuario[]>(`${this.publicApi}/medicos`);
  }

  horariosMedico(medicoId: number) {
    return this.http.get<Horario[]>(`${this.publicApi}/medicos/${medicoId}/horarios`);
  }

  agendarCita(data: CitaRequest) {
    return this.http.post<Cita>(`${this.api}/citas`, data);
  }

  historial() {
    return this.http.get<Cita[]>(`${this.api}/citas/historial`);
  }

  proximas() {
    return this.http.get<Cita[]>(`${this.api}/citas/proximas`);
  }

  cancelarCita(id: number) {
    return this.http.patch<Cita>(`${this.api}/citas/${id}/cancelar`, {});
  }
}
