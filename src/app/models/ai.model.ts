/* ======= Hospy AI =======
 * Modelos para: Triage NLP, Dermatología CNN, Escriba SOAP,
 * Interacciones Fármaco-Alimento (GNN), Triangulación Precios (IF+Prophet)
 */

export interface AiTriageRequest {
  sintomas: string;
  duracion?: string;
  antecedentes?: string;
  edadPaciente?: number;
  imagenBase64?: string;
}

export interface AiTriageResponse {
  severidad: string;         /* Rojo | Naranja | Amarillo | Verde | Azul */
  escala: string;            /* ESI/MTS 5 niveles */
  nivelEsi: number;          /* 1..5 */
  especialidadRecomendada: string;
  prioridad: number;         /* 1..10 */
  hallazgos: string[];
  recomendaciones: string;
  resumen: string;
  modoDemo?: boolean;
}

export interface AiDermatologyRequest {
  descripcion?: string;
  imagenBase64?: string;
  tiempoEvolucion?: string;
  sintomasAsociados?: string;
}

export interface AiDermatologyResponse {
  nivelRiesgo: string;       /* BAJO | MEDIO | ALTO | CRITICO */
  scoreRiesgo: number;       /* 0.0 .. 1.0 */
  explicacion?: string;
  diagnosticosDiferenciales: string[];
  caracteristicasObservadas: string[];
  recomendaciones: string;
  advertencia: string;
  modoDemo?: boolean;
}

export interface AiSoapRequest {
  transcripcionConsulta?: string;
  transcripcion?: string;
  nombrePaciente?: string;
  motivoInicial?: string;
}

export interface AiSoapResponse {
  subjetivo: string;          /* S */
  objetivo: string;           /* O */
  apreciacion: string;        /* A */
  plan: string;               /* P */
  diagnosticoPresuntivo: string;
  procedimientosSugeridos: string;
  procedimientos?: string[];
  especialidadSugerida?: string;
  modoDemo?: boolean;
}

export interface AiInteractionRequest {
  medicamentos: string[];
  dietaHabitual?: string[];
  suplementos?: string[];
}

export interface AlertaInteraccion {
  elementos: string;
  tipo: string;              /* FARMACO_FARMACO | FARMACO_ALIMENTO | FARMACO_SUPLEMENTO | GENERAL */
  severidad: string;
  mecanismo: string;
  consecuencia: string;
  accion: string;
}

export interface AiInteractionResponse {
  nivelRiesgoGlobal: string; /* NINGUNO | BAJO | MEDIO | ALTO | SEVERO */
  alertas: AlertaInteraccion[];
  recomendacionesDieteticas: string[];
  resumen: string;
  modoDemo?: boolean;
}

export interface AiPricesRequest {
  medicamento: string;
  presentacion?: string;
  precioReportado?: number;
  ciudad?: string;
}

export interface ComparativaFarmacia {
  nombre: string;
  precio: number;
  disponibilidad: string;
  url: string;
  farmacia?: string;
  porcentajeDiferencia?: number | string;
  ciudad?: string;
  sobreprecio?: boolean;
}

export interface AiPricesResponse {
  precioEsperadoMin: number;
  precioEsperadoMax: number;
  precioPromedio: number;
  evaluacionSobreprecio: string; /* DENTRO_RANGO | SOBREPRECIO_BAJO | SOBREPRECIO_ALTO | DESABASTECIMIENTO_ARTIFICIAL */
  porcentajeDesviacion: number;
  comparativa: ComparativaFarmacia[];
  alertas: string[];
  recomendacion: string;
  modoDemo?: boolean;
  nivelSobreprecio?: string;
  sospechaDesabastecimiento?: boolean;
  precioMinimo?: number;
  precioMaximo?: number;
  evaluacion?: string;
}

export interface AiStatusResponse {
  apiKeyActiva: boolean;
  version: string;
}

export interface AiTranscriptionResponse {
  texto: string;
  modoDemo: boolean;
  mensaje: string;
}

export interface AiAdminOperationRequest {
  instruccion: string;
}

export interface AiAdminOperationResponse {
  accion: 'CREAR_MEDICO' | 'CREAR_PACIENTE' | 'INFO' | string;
  nombre?: string;
  email?: string;
  especialidad?: string;
  passwordSugerida?: string;
  documento?: string;
  telefono?: string;
  mensaje: string;
  modoDemo?: boolean;
}

export interface AiMetrics {
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
