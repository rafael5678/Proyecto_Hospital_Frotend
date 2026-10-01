export interface PacientePerfil {
  id: number;
  usuarioId: number;
  nombre: string;
  email: string;
  telefono?: string;
  documento?: string;
  fechaNacimiento?: string;
  genero?: string;
  tipoSangre?: string;
  direccion?: string;
  ciudad?: string;
  alergias?: string;
  contactoEmergencia?: string;
  telefonoEmergencia?: string;
  observaciones?: string;
}

export interface PacienteDashboard {
  totalCitas: number;
  citasPendientes: number;
  citasAceptadas: number;
  citasCanceladas: number;
  proximasCitas: number;
}

export interface RegisterRequest {
  nombre: string;
  email: string;
  password: string;
  telefono?: string;
  documento: string;
  fechaNacimiento?: string;
  genero?: string;
  tipoSangre?: string;
  direccion?: string;
  ciudad?: string;
  alergias?: string;
  contactoEmergencia?: string;
  telefonoEmergencia?: string;
  observaciones?: string;
}
