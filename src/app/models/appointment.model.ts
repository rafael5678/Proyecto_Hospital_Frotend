export interface Appointment {
  id: number;
  pacienteId: number;
  pacienteNombre: string;
  pacienteDocumento?: string;
  medicoId: number;
  medicoNombre: string;
  medicoEspecialidad?: string;
  fechaHora: string;
  estado: string;
  motivo?: string;
  notas?: string;
  receta?: string;
  concluidaEn?: string;
  adelantada?: boolean;
  triageSeveridad?: string;
  triageNivelEsi?: number;
  triagePrioridad?: number;
  triageEspecialidadSugerida?: string;
  triageResumen?: string;
  triageSintomas?: string;
  triageDuracion?: string;
  triageAntecedentes?: string;
  dermatologiaReportaIa?: string;
  dermatologiaScoreRiesgo?: number;
  dermatologiaTopDiagnostico?: string;
  avisoAgenda?: string;
}

export function etiquetaCita(c: { estado?: string; fechaHora?: string; concluidaEn?: string; adelantada?: boolean }): string {
  const estado = (c.estado || '').toUpperCase();
  if (estado !== 'COMPLETADA') return estado || '—';
  const fecha = c.fechaHora ? new Date(c.fechaHora).getTime() : 0;
  const hecha = c.concluidaEn ? new Date(c.concluidaEn).getTime() : 0;
  const adelantada = !!c.adelantada || (hecha > 0 && fecha > hecha) || fecha > Date.now();
  return adelantada ? 'Aceptada · se adelantó' : 'Aceptada · concluida';
}

export interface AppointmentRequest {
  medicoId: number;
  fechaHora: string;
  motivo?: string;
  triageSeveridad?: string;
  triageNivelEsi?: number;
  triagePrioridad?: number;
  triageEspecialidadSugerida?: string;
  triageResumen?: string;
  triageSintomas?: string;
  triageDuracion?: string;
  triageAntecedentes?: string;
  dermatologiaReportaIa?: string;
  dermatologiaScoreRiesgo?: number;
  dermatologiaTopDiagnostico?: string;
}

export interface RescheduleAppointmentResponse {
  cita: Appointment;
  correoPacienteEnviado: boolean;
  correoMedicoEnviado: boolean;
  mensaje: string;
}
