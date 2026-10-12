export interface Horario {
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

export interface HorarioRequest {
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  disponible?: boolean;
}
