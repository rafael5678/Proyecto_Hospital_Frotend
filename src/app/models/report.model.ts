export interface Report {
  totalCitas: number;
  citasPendientes: number;
  citasAceptadas: number;
  citasCanceladas: number;
  totalPacientes: number;
  totalMedicos: number;
  desgloseMensual: { mes: number; nombreMes: string; totalCitas: number }[];
}
