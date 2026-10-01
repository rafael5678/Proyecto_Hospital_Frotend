export interface AiMetricas {
  totalCitas: number;
  citasConTriage: number;
  citasConEvaluacionPiel: number;
  citasPrioridadAlta: number;
  citasReprogramadasPorIA: number;
  distribucionSeveridad: { [key: string]: number };
  apiKeyActiva: boolean;
  versionIa: string;
  estadoWhisper: string;
  estadoSoap: string;
  estadoTriage: string;
  estadoDermatologia: string;
  estadoInteracciones: string;
  estadoPrecios: string;
  timeoutMedicoSeg: number;
  timeoutAdminSeg: number;
}
