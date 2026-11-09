/** Visit JSON and Colombia clock helpers. */

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

/** Clock numbers stored for the visit, shown as Colombia wall time without shifting them. */
export function formatColombia(iso?: string): string {
  if (!iso) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso);
  if (!match) return iso;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  return date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

/** If the visit already happened, show when it was done, not the future cupo. */
export function visitClock(c: { fechaHora?: string; concluidaEn?: string; estado?: string }): string {
  const hecha = (c.estado || '').toUpperCase() === 'COMPLETADA' || !!(c.concluidaEn && String(c.concluidaEn).trim());
  return hecha && c.concluidaEn ? c.concluidaEn : (c.fechaHora || '');
}

export function formatAppointmentWhen(c: { fechaHora?: string; concluidaEn?: string; estado?: string }): string {
  return formatColombia(visitClock(c));
}

/** Open slot label: weekday, calendar day, and HH:mm in Colombia wall time. */
export function formatSlotColombia(iso?: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso || '');
  if (!match) return '';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  const dia = date.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const nombre = dia ? dia.charAt(0).toUpperCase() + dia.slice(1) : '';
  return `${nombre} · ${match[4]}:${match[5]}`;
}

export function isFutureSlot(iso?: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso || '');
  if (!match) return false;
  const slot = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  return slot.getTime() > Date.now();
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
