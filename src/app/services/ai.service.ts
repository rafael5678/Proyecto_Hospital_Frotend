import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AiDermatologyRequest, AiDermatologyResponse,
  AiInteractionRequest, AiInteractionResponse,
  AiPricesRequest, AiPricesResponse, ComparativaFarmacia,
  AiSoapRequest, AiSoapResponse,
  AiConsultaSimRequest, AiConsultaSimResponse,
  AiStatusResponse,
  AiTriageRequest, AiTriageResponse,
  AiTranscriptionResponse,
  AiAdminOperationRequest, AiAdminOperationResponse
} from '../models/ai.model';

/** HTTP calls for triage, consult, pharmacy, and SOAP. */
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
      catchError(() => of(this.localTriage(req)))
    );
  }

  dermatology(req: AiDermatologyRequest) {
    return this.http.post<AiDermatologyResponse>(`${BASE}/dermatology`, req).pipe(
      catchError(() => of(this.localDermatology(req)))
    );
  }

  soap(req: AiSoapRequest) {
    const payload: AiSoapRequest = { ...req };
    const tx = payload.transcripcionConsulta || payload.transcripcion || '';
    payload.transcripcionConsulta = tx;
    payload.transcripcion = tx;
    return this.http.post<AiSoapResponse>(`${BASE}/soap`, payload).pipe(
      map(r => this.completeSoap(r, tx, payload.motivoInicial)),
      catchError(() => of(this.localSoap(tx, payload.nombrePaciente, payload.motivoInicial)))
    );
  }

  simulateVisit(req: AiConsultaSimRequest) {
    return this.http.post<AiConsultaSimResponse>(`${BASE}/consulta`, req).pipe(
      catchError(() => of(this.localConsult(req)))
    );
  }

  warmupConsult() {
    return this.http.post<{ ok: boolean }>(`${BASE}/warmup`, {}).pipe(
      catchError(() => of({ ok: false }))
    );
  }

  transcribe(audio: Blob) {
    const form = new FormData();
    form.append('audio', audio, 'consulta.webm');
    return this.http.post<AiTranscriptionResponse>(`${BASE}/transcribe`, form).pipe(
      catchError(() => of({
        texto: '',
        modoDemo: true,
        mensaje: 'No se escuchó nada. Pulsa Hablar, espera a ver el texto y luego Terminar y enviar.'
      }))
    );
  }

  interactions(req: AiInteractionRequest) {
    return this.http.post<AiInteractionResponse>(`${BASE}/interactions`, req).pipe(
      catchError(() => of(this.localInteractions(req)))
    );
  }

  runAdminOperation(req: AiAdminOperationRequest) {
    return this.http.post<AiAdminOperationResponse>(`${BASE}/admin-operacion`, req);
  }

  estimatePrices(req: AiPricesRequest) {
    return this.http.post<AiPricesResponse>(`${BASE}/prices`, req).pipe(
      map(r => this.placePrices(r, req)),
      catchError(() => of(this.localPrices(req)))
    );
  }

  private localTriage(req: AiTriageRequest): AiTriageResponse {
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
    } else if (/mano|hinchad|edema|inflamad|esguince|muñeca|muneca|golpe|fractura/.test(s)) {
      severidad = 'Amarillo'; nivelEsi = 3; prioridad = 5; especialidadRecomendada = 'Traumatología';
      hallazgos.push('Inflamación o trauma de extremidad');
    } else if (/piel|mancha|lesi[oó]n|acn[eé]/.test(s)) {
      especialidadRecomendada = 'Dermatología';
    } else if (/gripe|resfriado|tos/.test(s)) {
      severidad = 'Azul'; nivelEsi = 5; prioridad = 2;
    }
    return {
      severidad, escala: 'ESI/MTS orientativo', nivelEsi, especialidadRecomendada, prioridad, hallazgos,
      recomendaciones: 'Si hay dolor de pecho o ahogo intenso, acude a urgencias.',
      resumen: `Severidad ${severidad} hacia ${especialidadRecomendada}.`,
      modoDemo: false
    };
  }

  private localDermatology(req: AiDermatologyRequest): AiDermatologyResponse {
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
    } else if (/mano|hinchad|edema|inflamad|golpe|esguince/.test(d)) {
      nivelRiesgo = 'MEDIO'; scoreRiesgo = 0.4;
      diagnosticosDiferenciales = ['Edema o inflamación de extremidad', 'Contusión de tejidos blandos'];
    }
    return {
      nivelRiesgo, scoreRiesgo,
      explicacion: nivelRiesgo === 'ALTO'
        ? 'La lesión o la inflamación que describes tiene signos que conviene revisar pronto.'
        : 'Hay un cambio en la piel. Vigílalo y consulta si empeora o aparece fiebre.',
      diagnosticosDiferenciales,
      caracteristicasObservadas: [],
      recomendaciones: '',
      advertencia: '',
      modoDemo: false
    };
  }

  private completeSoap(r: AiSoapResponse, tx: string, motivo?: string): AiSoapResponse {
    if (r.resumenParaMedico?.trim()) return r;
    const local = this.localSoap(tx, '', motivo);
    return {
      ...r,
      resumenParaMedico: r.apreciacion || local.resumenParaMedico,
      enfoqueEnConsulta: r.plan || local.enfoqueEnConsulta,
      preguntasSugeridas: local.preguntasSugeridas,
      medicamentosSugeridos: local.medicamentosSugeridos,
      cuidados: local.cuidados
    };
  }

  private localSoap(tx: string, nombre?: string, motivo?: string): AiSoapResponse {
    const corte = tx.length > 280 ? tx.slice(0, 280) + '…' : tx;
    return {
      resumenParaMedico: `${nombre || 'El paciente'} consulta por ${motivo || 'un malestar'}. ${corte ? 'En el relato: ' + corte : 'Aún no hay más detalle.'}`,
      enfoqueEnConsulta: 'Pregunta desde cuándo empezó, examina la zona y decide el medicamento después del examen.',
      preguntasSugeridas: '¿Desde cuándo le pasa?\n¿Ya tomó algo?\n¿Qué lo empeora?',
      medicamentosSugeridos: 'Analgésico habitual · tabletas · solo si no hay alergia y el examen lo permite',
      cuidados: 'Reposo relativo, movimiento suave y volver si aparece fiebre o el dolor se pone intenso.',
      subjetivo: `Refiere: ${corte || 'no informado'}`,
      objetivo: 'Signos vitales: no informados en la transcripción.',
      apreciacion: 'Impresión pendiente de examen físico. Borrador local.',
      plan: 'Examinar, elegir el manejo y dejar los cuidados por escrito.',
      diagnosticoPresuntivo: 'Pendiente de tu examen',
      procedimientosSugeridos: 'No informado',
      modoDemo: true
    };
  }

  private localConsult(req: AiConsultaSimRequest): AiConsultaSimResponse {
    const motivo = req.motivo?.trim() || 'el malestar que le conté';
    const texto = `${req.motivo || ''} ${req.contexto || ''}`.toLowerCase();
    const pregunta = (req.pregunta || '').toLowerCase();
    const dias = texto.match(/(\d+)\s*d[ií]as/);
    let dice: string;
    if (!pregunta.trim()) {
      dice = `Doctor, buenos días. Vengo porque ${motivo}.${dias ? ` Llevo así como ${dias[1]} días.` : ''}`;
    } else if (/alerg/.test(pregunta)) {
      dice = 'No, doctor. Alergias a medicamentos no tengo, que yo sepa. Ni a comidas, que recuerde.';
    } else if (/tiempo|cu[aá]nto|desde|d[ií]a|evoluci/.test(pregunta)) {
      dice = dias
        ? `Llevo más o menos ${dias[1]} días, doctor. Empezó de a poco y no se me ha quitado.`
        : 'Empezó hace unos días, doctor. No sabría decirle la hora exacta, pero no es de hoy.';
    } else if (/fiebre|calentur|temperatura/.test(pregunta)) {
      dice = 'Fiebre no he tenido, doctor. Estoy molesto, pero sin escalofrío ni temperatura alta.';
    } else if (/tom[oóe]|pastilla|medic|analg/.test(pregunta)) {
      dice = 'No he tomado nada formulado. A lo mucho un analgésico de la casa, y el malestar sigue ahí.';
    } else if (/s[ií]ntoma|qu[eé] m[aá]s|duele|siente|espalda|pecho/.test(pregunta)) {
      dice = `Lo que más siento es ${motivo}. Me molesta al moverme y si llevo rato en la misma posición. Falta de aire o un dolor que se vaya al pecho, no.`;
    } else if (/empeor|mejor|alivia|reposo|ejerc|fuerza/.test(pregunta)) {
      dice = 'Me empeora si hago fuerza o si estoy mucho tiempo sentado. En reposo baja un poco, pero no se quita.';
    } else {
      dice = `Doctor, sobre eso le cuento con lo que sé: sigo con ${motivo}. Si me pregunta más, se lo digo tal como lo siento.`;
    }
    return {
      dicePaciente: dice,
      medicamentosSugeridos: 'Analgésico habitual · tabletas · si no hay alergia y el examen lo permite\nCalor local y movimiento suave · mientras se aclara la causa',
      cuidados: 'Calor local, caminar suave y evitar cargar peso. Volver si aparece fiebre, falta de aire o el dolor se va al pecho.',
      modoDemo: true
    };
  }

  private localInteractions(req: AiInteractionRequest): AiInteractionResponse {
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

  private localPrices(req: AiPricesRequest): AiPricesResponse {
    const med = (req.medicamento || '').toLowerCase();
    let base = 30000;
    if (/acetamin|paracetamol|ibuprofeno/.test(med)) base = 7500;
    else if (/amoxicilina/.test(med)) base = 22000;
    const reportado = req.precioReportado ?? base;
    const desv = ((reportado - base) / base) * 100;
    let evaluacionSobreprecio = 'DENTRO_RANGO';
    if (desv > 45) evaluacionSobreprecio = 'SOBREPRECIO_ALTO';
    else if (desv > 15) evaluacionSobreprecio = 'SOBREPRECIO_BAJO';
    const presentacion = req.presentacion?.trim() || 'caja de tabletas, presentación habitual';
    const puntos = this.salesPoints(req.ciudad);
    return {
      presentacionEstimada: presentacion,
      precioEsperadoMin: Math.round(base * 0.78),
      precioEsperadoMax: Math.round(base * 1.35),
      precioPromedio: base,
      evaluacionSobreprecio,
      porcentajeDesviacion: Math.round(desv * 10) / 10,
      comparativa: puntos.map((p, i) => ({
        nombre: p.nombre,
        lugar: p.lugar,
        presentacion,
        precio: Math.round(base * [0.86, 0.97, 1.08, 1.2][i]),
        disponibilidad: 'Precio aproximado, sin confirmar stock',
        url: ''
      })),
      alertas: [`Rango aproximado en ${req.ciudad || 'Colombia'}. No es el precio de caja de hoy.`],
      recomendacion: 'Compara la misma presentación. La cifra más baja es una referencia, no una oferta.',
      modoDemo: true
    };
  }

  private placePrices(r: AiPricesResponse, req: AiPricesRequest): AiPricesResponse {
    const presentacion = r.presentacionEstimada || req.presentacion?.trim() || 'caja de tabletas, presentación habitual';
    const puntos = this.salesPoints(req.ciudad);
    const base = r.precioPromedio || r.precioEsperadoMin || 20000;
    const lista = (r.comparativa?.length ? r.comparativa : puntos.map((p, i): ComparativaFarmacia => ({
      nombre: p.nombre,
      precio: Math.round(base * [0.86, 0.97, 1.08, 1.2][i]),
      disponibilidad: 'Precio aproximado, sin confirmar stock',
      url: ''
    }))).map((f, i) => ({
      ...f,
      nombre: f.nombre || f.farmacia || puntos[i % puntos.length].nombre,
      lugar: f.lugar || f.ciudad || puntos[i % puntos.length].lugar,
      presentacion: f.presentacion || presentacion,
      disponibilidad: f.disponibilidad || 'Precio aproximado, sin confirmar stock'
    })).sort((a, b) => (a.precio || 0) - (b.precio || 0));
    return { ...r, presentacionEstimada: presentacion, comparativa: lista };
  }

  private salesPoints(ciudad?: string): { nombre: string; lugar: string }[] {
    const c = (ciudad || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    if (c.includes('pasto')) return [
      { nombre: 'La Rebaja', lugar: 'Valle de Atriz' },
      { nombre: 'Cruz Verde', lugar: 'Unicentro' },
      { nombre: 'Droguería del centro', lugar: 'Centro, calle 18' },
      { nombre: 'Copservir', lugar: 'Avenida Panamericana' }
    ];
    if (c.includes('bogota')) return [
      { nombre: 'Colsubsidio', lugar: 'Chapinero' },
      { nombre: 'Cruz Verde', lugar: 'Unicentro' },
      { nombre: 'Farmatodo', lugar: 'Salitre Plaza' },
      { nombre: 'Locatel', lugar: 'Centro Internacional' }
    ];
    if (c.includes('medellin')) return [
      { nombre: 'La Rebaja', lugar: 'Laureles' },
      { nombre: 'Cruz Verde', lugar: 'El Tesoro' },
      { nombre: 'Farmatodo', lugar: 'Santa Fe' },
      { nombre: 'Droguería de barrio', lugar: 'Centro' }
    ];
    if (c.includes('cali')) return [
      { nombre: 'Cruz Verde', lugar: 'Unicentro' },
      { nombre: 'La Rebaja', lugar: 'Chipichape' },
      { nombre: 'Farmatodo', lugar: 'Granada' },
      { nombre: 'Droguería del centro', lugar: 'Centro' }
    ];
    const sitio = ciudad?.trim() || 'la ciudad';
    return [
      { nombre: 'La Rebaja', lugar: `Centro de ${sitio}` },
      { nombre: 'Cruz Verde', lugar: `Centro comercial de ${sitio}` },
      { nombre: 'Droguería de barrio', lugar: `Barrio céntrico de ${sitio}` },
      { nombre: 'Olímpica', lugar: `Zona comercial de ${sitio}` }
    ];

  }
}
