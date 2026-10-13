export interface Schedule {
  id: number;
  medicoId: number;
  diaSemana: number;
  diaNombre?: string;
  horaInicio: string;
  horaFin: string;
  disponible: boolean;
}

export interface CupoDisponible {
  fechaHora: string;
  etiqueta: string;
  dia: string;
  ocupadoMenorPrioridad?: boolean;
}

export interface ScheduleRequest {
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  disponible?: boolean;
}
