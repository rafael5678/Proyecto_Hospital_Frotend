import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AiDermatologiaRequest, AiDermatologiaResponse,
  AiInteraccionRequest, AiInteraccionResponse,
  AiPreciosRequest, AiPreciosResponse,
  AiSoapRequest, AiSoapResponse,
  AiStatusResponse,
  AiTriageRequest, AiTriageResponse,
  AiTranscripcionResponse
} from '../models/ai.model';

const BASE = environment.apiUrl + '/ai';
const DEMO = 'Modo local: el servidor de IA no respondió. Resultado orientativo para continuar; no es diagnóstico.';

@Injectable({ providedIn: 'root' })
export class AiService {
  private http = inject(HttpClient);

  status() {
    return this.http.get<AiStatusResponse>(`${BASE}/status`).pipe(
      catchError(() => of({ apiKeyActiva: false, version: 'Hospy AI local (sin conexión al backend)' }))
    );
  }

  triage(req: AiTriageRequest) {
    return this.http.post<AiTriageResponse>(`${BASE}/triage`, req).pipe(
      catchError(() => of(this.triageLocal(req)))
    );
  }

  dermatologia(req: AiDermatologiaRequest) {
    return this.http.post<AiDermatologiaResponse>(`${BASE}/dermatologia`, req).pipe(
      catchError(() => of(this.dermLocal(req)))
    );
  }

  soap(req: AiSoapRequest) {
    const payload: AiSoapRequest = { ...req };
    const tx = payload.transcripcionConsulta || payload.transcripcion || '';
    payload.transcripcionConsulta = tx;
    payload.transcripcion = tx;
    return this.http.post<AiSoapResponse>(`${BASE}/soap`, payload).pipe(
      catchError(() => of(this.soapLocal(tx, payload.nombrePaciente)))
    );
  }

  transcribir(audio: Blob) {
    const form = new FormData();
    form.append('audio', audio, 'consulta.webm');
    return this.http.post<AiTranscripcionResponse>(`${BASE}/transcribir`, form).pipe(
      catchError(() => of({
        texto: '',
        modoDemo: true,
        mensaje: 'Whisper no disponible. Usa la transcripción en vivo del navegador o escribe el texto.'
      }))
    );
  }

  interacciones(req: AiInteraccionRequest) {
    return this.http.post<AiInteraccionResponse>(`${BASE}/interacciones`, req).pipe(
      catchError(() => of(this.interLocal(req)))
    );
  }

  precios(req: AiPreciosRequest) {
    return this.http.post<AiPreciosResponse>(`${BASE}/precios`, req).pipe(
      catchError(() => of(this.preciosLocal(req)))
    );
  }

  private triageLocal(req: AiTriageRequest): AiTriageResponse {
    const s = (req.sintomas || '').toLowerCase();
    let severidad = 'Verde', nivelEsi = 4, prioridad = 4, especialidadRecomendada = 'Medicina General';
    const hallazgos = ['Orientación local por palabras clave'];
    if (/pecho|infarto|desmayo|inconsciente/.test(s)) {
      severidad = 'Rojo'; nivelEsi = 1; prioridad = 10; especialidadRecomendada = 'Cardiología';
      hallazgos.push('Posible urgencia cardiovascular');
    } else if (/respirar|disnea|fiebre alta/.test(s)) {
      severidad = 'Naranja'; nivelEsi = 2; prioridad = 8; especialidadRecomendada = 'Neumología';
    } else if (/cabeza|cefalea|mareo/.test(s)) {
      severidad = 'Amarillo'; nivelEsi = 3; prioridad = 6; especialidadRecomendada = 'Neurología';
    } else if (/piel|mancha|lesi[oó]n|acn[eé]/.test(s)) {
      especialidadRecomendada = 'Dermatología';
    } else if (/gripe|resfriado|tos/.test(s)) {
      severidad = 'Azul'; nivelEsi = 5; prioridad = 2;
    }
    return {
      severidad, escala: 'ESI/MTS orientativo', nivelEsi, especialidadRecomendada, prioridad, hallazgos,
      recomendaciones: 'Orientación con reglas ESI/MTS locales. Si hay dolor de pecho o ahogo intenso, acude a urgencias.',
      resumen: `Orientación ${severidad} (prioridad ${prioridad}/10) hacia ${especialidadRecomendada}.`,
      modoDemo: false
    };
  }

  private dermLocal(req: AiDermatologiaRequest): AiDermatologiaResponse {
    const d = (req.descripcion || '').toLowerCase();
    let nivelRiesgo = 'BAJO', scoreRiesgo = 0.18;
    let diagnosticosDiferenciales = ['Dermatitis', 'Picadura'];
    if (/celulitis|culebrilla|herpes zoster|herpes zóster/.test(d)) {
      nivelRiesgo = 'ALTO'; scoreRiesgo = 0.8;
      diagnosticosDiferenciales = ['Infección cutánea a valorar', 'Dermatología preferente'];
    } else if (/asimetr|sangra|ulcera|cambia de color/.test(d)) {
      nivelRiesgo = 'ALTO'; scoreRiesgo = 0.78;
      diagnosticosDiferenciales = ['Lesión pigmentada a valorar', 'Consulta dermatológica urgente'];
    } else if (/roncha|urticaria|pica|varicela|tiña/.test(d)) {
      nivelRiesgo = 'MEDIO'; scoreRiesgo = 0.42;
      diagnosticosDiferenciales = ['Urticaria', 'Dermatitis atópica'];
    }
    return {
      nivelRiesgo, scoreRiesgo, diagnosticosDiferenciales,
      caracteristicasObservadas: [
        req.imagenBase64
          ? 'El servidor de IA no respondió; la foto no se pudo clasificar en este intento.'
          : 'Análisis de texto local (sin imagen)'
      ],
      recomendaciones: 'Clasificación local de respaldo. Correlacionar con examen físico en Dermatología.',
      advertencia: 'No sustituye consulta con dermatólogo.',
      modoDemo: false
    };
  }

  private soapLocal(tx: string, nombre?: string): AiSoapResponse {
    const corte = tx.length > 280 ? tx.slice(0, 280) + '…' : tx;
    return {
      subjetivo: `${nombre || 'Paciente'} refiere: ${corte || 'No informado'}`,
      objetivo: 'Signos vitales: no informados en la transcripción.',
      apreciacion: 'Impresión pendiente de examen físico. Borrador local.',
      plan: DEMO + ' Revisar, completar y firmar la nota.',
      diagnosticoPresuntivo: 'Pendiente de confirmación',
      procedimientosSugeridos: 'No informado',
      modoDemo: true
    };
  }

  private interLocal(req: AiInteraccionRequest): AiInteraccionResponse {
    const meds = (req.medicamentos || []).join(', ') || 'ninguno';
    return {
      nivelRiesgoGlobal: 'BAJO',
      alertas: [{
        elementos: meds,
        tipo: 'GENERAL',
        severidad: 'INFORMATIVA',
        mecanismo: 'Revisión local sin catálogo farmacológico.',
        consecuencia: 'No confirma ausencia de interacciones.',
        accion: 'Confirmar con médico o farmacéutico.'
      }],
      recomendacionesDieteticas: ['Tomar medicamentos con agua', 'No suspender tratamiento por esta orientación'],
      resumen: DEMO,
      modoDemo: true
    };
  }

  private preciosLocal(req: AiPreciosRequest): AiPreciosResponse {
    const med = (req.medicamento || '').toLowerCase();
    let base = 30000;
    if (/acetamin|paracetamol|ibuprofeno/.test(med)) base = 7500;
    else if (/amoxicilina/.test(med)) base = 22000;
    const reportado = req.precioReportado ?? base;
    const desv = ((reportado - base) / base) * 100;
    let evaluacionSobreprecio = 'DENTRO_RANGO';
    if (desv > 45) evaluacionSobreprecio = 'SOBREPRECIO_ALTO';
    else if (desv > 15) evaluacionSobreprecio = 'SOBREPRECIO_BAJO';
    return {
      precioEsperadoMin: Math.round(base * 0.78),
      precioEsperadoMax: Math.round(base * 1.35),
      precioPromedio: base,
      evaluacionSobreprecio,
      porcentajeDesviacion: Math.round(desv * 10) / 10,
      comparativa: [
        { nombre: 'Cruz Verde', precio: Math.round(base * 1.05), disponibilidad: 'Referencia demo', url: 'https://www.cruzverde.com.co' },
        { nombre: 'Farmatodo', precio: Math.round(base * 0.98), disponibilidad: 'Referencia demo', url: 'https://www.farmatodo.com.co' }
      ],
      alertas: [DEMO],
      recomendacion: 'Verifica el precio en la droguería. Esta cifra es orientativa.',
      modoDemo: true
    };
  }
}
