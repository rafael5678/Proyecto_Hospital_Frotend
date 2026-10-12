export interface Cita {
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

export interface CitaRequest {
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

export interface ReprogramarCitaResponse {
  cita: Cita;
  correoPacienteEnviado: boolean;
  correoMedicoEnviado: boolean;
  mensaje: string;
}
