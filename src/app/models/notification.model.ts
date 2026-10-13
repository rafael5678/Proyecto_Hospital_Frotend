export interface Notification {
  id: number;
  titulo: string;
  mensaje: string;
  tipo: string;
  leida: boolean;
  citaId?: number;
  creadaEn: string;
}
