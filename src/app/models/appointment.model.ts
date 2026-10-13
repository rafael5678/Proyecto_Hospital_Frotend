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
