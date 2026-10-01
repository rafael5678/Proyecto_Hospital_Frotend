import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Cita, ReprogramarCitaResponse } from '../models/cita.model';
import { Reporte } from '../models/reporte.model';
import { Usuario, UsuarioRequest } from '../models/usuario.model';
import { AiMetricas } from '../models/ai-metricas.model';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) {}

  listarUsuarios() {
    return this.http.get<Usuario[]>(`${this.api}/usuarios`);
  }

  crearUsuario(data: UsuarioRequest) {
    return this.http.post<Usuario>(`${this.api}/usuarios`, data);
  }

  actualizarUsuario(id: number, data: UsuarioRequest) {
    return this.http.put<Usuario>(`${this.api}/usuarios/${id}`, data);
  }

  desactivarUsuario(id: number) {
    return this.http.delete(`${this.api}/usuarios/${id}`);
  }

  cambiarEstado(id: number, activo: boolean) {
    return this.http.patch<Usuario>(`${this.api}/usuarios/${id}/estado`, {}, { params: { activo } });
  }

  listarMedicos() {
    return this.http.get<Usuario[]>(`${this.api}/medicos`);
  }

  crearMedico(data: UsuarioRequest) {
    return this.http.post<Usuario>(`${this.api}/medicos`, data);
  }

  actualizarMedico(id: number, data: UsuarioRequest) {
    return this.http.put<Usuario>(`${this.api}/medicos/${id}`, data);
  }

  supervisarCitas() {
    return this.http.get<Cita[]>(`${this.api}/citas`);
  }

  reprogramarCita(id: number, fechaHora: string, motivo: string) {
    return this.http.patch<ReprogramarCitaResponse>(`${this.api}/citas/${id}/reprogramar`, { fechaHora, motivo });
  }

  reportes(anio = new Date().getFullYear()) {
    return this.http.get<Reporte>(`${this.api}/reportes`, { params: { anio } });
  }

  aiMetricas() {
    return this.http.get<AiMetricas>(`${this.api}/ai-metricas`);
  }
}
