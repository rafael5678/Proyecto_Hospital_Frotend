export interface AuthResponse {
  token: string;
  tipo: string;
  id: number;
  nombre: string;
  email: string;
  rol: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  rol?: string;
}

export interface RegisterRequest {
  nombre: string;
  email: string;
  password: string;
  telefono?: string;
  documento?: string;
}

export interface SessionUser {
  token: string;
  id: number;
  nombre: string;
  email: string;
  rol: string;
}
