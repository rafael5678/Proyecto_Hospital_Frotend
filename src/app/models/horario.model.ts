export interface Horario {
  id: number;
  medicoId: number;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  disponible: boolean;
}

export interface HorarioRequest {
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  disponible?: boolean;
}

// Definición de modelo Horario: Representa los rangos de atención disponibles configurados por el médico.
