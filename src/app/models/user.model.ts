export interface User {
  id: number;
  usuarioId?: number;
  nombre: string;
  email: string;
  rol: string;
  telefono?: string;
  documento?: string;
  especialidad?: string;
  consultorio?: string;
  anosExperiencia?: number;
  biografia?: string;
  activo?: boolean;
}

export interface UserRequest {
  nombre: string;
  email: string;
  password?: string;
  rol: string;
  telefono?: string;
  documento?: string;
  especialidad?: string;
  fechaNacimiento?: string;
  genero?: string;
  ciudad?: string;
  alergias?: string;
  numeroLicencia?: string;
  consultorio?: string;
  anosExperiencia?: number;
  biografia?: string;
  diasAtencion?: string;
  horaInicio?: string;
  horaFin?: string;
  horaInicio2?: string;
  horaFin2?: string;
  activo?: boolean;
}
