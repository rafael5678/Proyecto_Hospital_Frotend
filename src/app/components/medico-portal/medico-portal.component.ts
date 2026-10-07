import { Component, inject, OnDestroy, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { MedicoService, MedicoDashboard, MedicoPerfil } from '../../services/medico.service';
import { Cita } from '../../models/cita.model';
import { Horario } from '../../models/horario.model';
import { PacientePerfil } from '../../models/paciente-perfil.model';
import { PortalSidebarComponent, SidebarItem } from '../portal-sidebar/portal-sidebar.component';
import { SessionTimeoutComponent } from '../session-timeout/session-timeout.component';
import { AiService } from '../../services/ai.service';
import {
  AiSoapRequest, AiSoapResponse,
  AiPreciosRequest, AiPreciosResponse, ComparativaFarmacia
} from '../../models/ai.model';

type MedicoTab = 'inicio' | 'citas' | 'horarios' | 'paciente' | 'soap' | 'precios';
type MedicoSub = '' | 'todas' | 'pendientes' | 'aceptadas' | 'lista' | 'agregar';

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionFactory = new () => SpeechRecognitionLike;

@Component({
  selector: 'app-medico-portal',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe, PortalSidebarComponent, SessionTimeoutComponent],
  templateUrl: './medico-portal.component.html',
  styleUrl: './medico-portal.component.css'
})
export class MedicoPortalComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  private svc = inject(MedicoService);
  private ai = inject(AiService);

  tab = signal<MedicoTab>('inicio');
  sub = signal<MedicoSub>('');
  expandedMenus = signal<string[]>(['citas', 'horarios']);

  readonly baseMenu: SidebarItem[] = [
    { id: 'inicio', label: 'Inicio', icon: '🏠', tab: 'inicio' },
    {
      id: 'citas',
      label: 'Citas',
      icon: '📅',
      children: [
        { id: 'c-todas', label: 'Todas las citas', tab: 'citas', sub: 'todas' },
        { id: 'c-pend', label: 'Pendientes', tab: 'citas', sub: 'pendientes' },
        { id: 'c-acep', label: 'Aceptadas', tab: 'citas', sub: 'aceptadas' }
      ]
    },
    {
      id: 'horarios',
      label: 'Horarios',
      icon: '🕐',
      children: [
        { id: 'h-lista', label: 'Mis horarios', tab: 'horarios', sub: 'lista' },
        { id: 'h-agregar', label: 'Agregar horario', tab: 'horarios', sub: 'agregar' }
      ]
    },
    {
      id: 'ia',
      label: 'IA Hospitalaria',
      icon: '🤖',
      children: [
        { id: 'ia-soap', label: 'Escriba SOAP', tab: 'soap' }
      ]
    },
    {
      id: 'meds',
      label: 'Medicamentos',
      icon: '💊',
      children: [
        { id: 'meds-precios', label: 'Triangular precios', tab: 'precios' }
      ]
    }
  ];

  menuItems = computed(() => {
    const items = [...this.baseMenu];
    if (this.pacienteSeleccionado()) {
      items.push({ id: 'paciente', label: 'Ficha paciente', icon: '📋', tab: 'paciente' });
    }
    return items;
  });

  dashboard = signal<MedicoDashboard | null>(null);
  perfil = signal<MedicoPerfil | null>(null);
  citas = signal<Cita[]>([]);
  horarios = signal<Horario[]>([]);
  pacienteSeleccionado = signal<PacientePerfil | null>(null);
  citaEnRevision = signal<Cita | null>(null);
  historialPaciente = signal<Cita[]>([]);

  diaSemana = 1;
  horaInicio = '08:00';
  horaFin = '12:00';
  error = signal('');

  soapReq: AiSoapRequest = {
    nombrePaciente: '',
    motivoInicial: '',
    transcripcion: ''
  };
  soapRsp = signal<AiSoapResponse | null>(null);
  soapLoading = signal(false);
  grabandoConsulta = signal(false);
  transcribiendoAudio = signal(false);
  consentimientoAudio = false;
  consentimientoSoapAi = false;
  transcripcionEnVivo = signal('');
  vozError = signal('');
  private grabadora: MediaRecorder | null = null;
  private recognition: SpeechRecognitionLike | null = null;
  private audioChunks: Blob[] = [];

  preciosReq: AiPreciosRequest = {
    medicamento: '',
    presentacion: '',
    precioReportado: 0,
    ciudad: 'Bogotá'
  };
  preciosPrecioTxt = '';
  preciosRsp = signal<AiPreciosResponse | null>(null);
  preciosLoading = signal(false);

  ngOnInit() {
    this.cargarInicio();
    this.cargarCitas();
    this.cargarHorarios();
    this.svc.perfil().subscribe({ next: p => this.perfil.set(p) });
  }

  ngOnDestroy() {
    this.recognition?.stop();
    if (this.grabadora?.state === 'recording') this.grabadora.stop();
  }

  onNavigate(item: SidebarItem) {
    if (!item.tab) return;
    this.tab.set(item.tab as MedicoTab);
    this.sub.set((item.sub ?? '') as MedicoSub);
    if (item.tab === 'citas') this.applyFiltroFromSub(item.sub);
    const group = this.baseMenu.find(m => m.children?.some(c => c.id === item.id));
    if (group && !this.expandedMenus().includes(group.id)) {
      this.expandedMenus.set([...this.expandedMenus(), group.id]);
    }
  }

  onToggleGroup(id: string) {
    const list = this.expandedMenus();
    if (list.includes(id)) {
      this.expandedMenus.set(list.filter(x => x !== id));
    } else {
      this.expandedMenus.set([...list, id]);
    }
  }

  private applyFiltroFromSub(sub?: string) {
    if (sub === 'pendientes') this.filtroEstado = 'PENDIENTE';
    else if (sub === 'aceptadas') this.filtroEstado = 'ACEPTADA';
    else this.filtroEstado = '';
  }

  filtroEstado = '';

  pageTitle(): string {
    const map: Record<string, string> = {
      inicio: 'Panel médico',
      'citas-todas': 'Citas — todas',
      'citas-pendientes': 'Citas — pendientes',
      'citas-aceptadas': 'Citas — aceptadas',
      'horarios-lista': 'Horarios — listado',
      'horarios-agregar': 'Horarios — agregar',
      paciente: 'Ficha del paciente',
      soap: 'IA — Escriba médico SOAP',
      precios: 'IA — Triangulación de precios'
    };
    const key = this.sub() ? `${this.tab()}-${this.sub()}` : this.tab();
    return map[key] ?? 'Portal médico';
  }

  cargarInicio() {
    this.svc.dashboard().subscribe({ next: d => this.dashboard.set(d) });
  }

  citasFiltradas(): Cita[] {
    if (!this.filtroEstado) return this.citas();
    return this.citas().filter(c => c.estado === this.filtroEstado);
  }

  cargarCitas() {
    this.svc.misCitas().subscribe({
      next: c => this.citas.set(c),
      error: () => this.error.set('Error al cargar citas')
    });
  }

  cargarHorarios() {
    this.svc.misHorarios().subscribe({ next: h => this.horarios.set(h) });
  }

  aceptar(id: number) {
    this.svc.aceptar(id).subscribe({ next: () => { this.cargarCitas(); this.cargarInicio(); } });
  }

  rechazar(id: number) {
    this.svc.rechazar(id).subscribe({ next: () => { this.cargarCitas(); this.cargarInicio(); } });
  }

  verPaciente(citaId: number) {
    this.citaEnRevision.set(this.citas().find(c => c.id === citaId) ?? null);
    this.historialPaciente.set([]);
    this.svc.verPaciente(citaId).subscribe({
      next: p => {
        this.pacienteSeleccionado.set(p);
        /* Auto-llenar SOAP con datos del paciente y triage */
        const cita = this.citaEnRevision();
        this.soapReq.nombrePaciente = p.nombre;
        this.soapReq.motivoInicial = cita?.motivo || cita?.triageSintomas || '';
        if (cita?.triageResumen && !this.soapReq.transcripcion) {
          this.soapReq.transcripcion = `[Triage IA pre-consulta] Severidad: ${cita.triageSeveridad || 'N/A'}, ` +
            `Prioridad: ${cita.triagePrioridad || 'N/A'}/10. ${cita.triageResumen}\n` +
            (cita.triageSintomas ? `Síntomas: ${cita.triageSintomas}\n` : '') +
            (cita.triageAntecedentes ? `Antecedentes: ${cita.triageAntecedentes}\n` : '') +
            (cita.dermatologiaReportaIa ? `[Dermatología IA] ${cita.dermatologiaReportaIa}\n` : '') +
            '\n--- Transcripción de consulta ---\n';
        }
        this.svc.historialPaciente(citaId).subscribe({
          next: historial => this.historialPaciente.set(historial),
          error: () => this.error.set('No se pudo cargar el historial previo del paciente.')
        });
        this.tab.set('paciente');
        this.sub.set('');
      }
    });
  }

  agregarHorario() {
    this.svc.crearHorario({
      diaSemana: this.diaSemana,
      horaInicio: this.horaInicio,
      horaFin: this.horaFin,
      disponible: true
    }).subscribe({
      next: () => {
        this.cargarHorarios();
        this.cargarInicio();
        this.sub.set('lista');
        this.tab.set('horarios');
      }
    });
  }

  eliminarHorario(id: number) {
    this.svc.eliminarHorario(id).subscribe({ next: () => this.cargarHorarios() });
  }

  badgeClass(estado: string): string {
    return 'badge badge-' + estado.toLowerCase();
  }

  soapGenerar() {
    if (!this.consentimientoSoapAi) {
      this.error.set('Confirma que el paciente autorizó el envío de la transcripción al servicio de IA.');
      return;
    }
    const tx = (this.soapReq.transcripcion || this.soapReq.transcripcionConsulta || '').trim();
    if (!tx) {
      this.error.set('Escriba o pegue la transcripción de la consulta.');
      return;
    }
    this.soapReq.transcripcion = tx;
    this.soapReq.transcripcionConsulta = tx;
    this.error.set('');
    this.soapLoading.set(true);
    this.ai.soap(this.soapReq).subscribe({
      next: r => this.soapRsp.set(r),
      complete: () => this.soapLoading.set(false)
    });
  }

  async iniciarGrabacion() {
    this.vozError.set('');
    if (!this.consentimientoAudio) {
      this.vozError.set('Confirma el consentimiento antes de grabar y enviar audio clínico.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      this.vozError.set('Este navegador no permite grabar audio. Puedes escribir la transcripción.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.transcripcionEnVivo.set('');
      this.grabadora = new MediaRecorder(stream);
      this.grabadora.ondataavailable = event => {
        if (event.data.size) this.audioChunks.push(event.data);
      };
      this.grabadora.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const audio = new Blob(this.audioChunks, { type: this.grabadora?.mimeType || 'audio/webm' });
        if (audio.size) this.subirAudio(audio);
      };
      this.grabadora.start();
      this.grabandoConsulta.set(true);
      this.iniciarReconocimientoNavegador();
    } catch {
      this.vozError.set('No se pudo acceder al micrófono. Revisa permisos del navegador.');
    }
  }

  detenerGrabacion() {
    this.recognition?.stop();
    this.recognition = null;
    this.grabandoConsulta.set(false);
    if (this.grabadora?.state === 'recording') this.grabadora.stop();
  }

  private iniciarReconocimientoNavegador() {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionFactory;
      webkitSpeechRecognition?: SpeechRecognitionFactory;
    };
    const Factory = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Factory) return;
    this.recognition = new Factory();
    this.recognition.lang = 'es-CO';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.onresult = event => {
      const text = Array.from(event.results).map(result => result[0].transcript).join(' ');
      this.transcripcionEnVivo.set(text);
    };
    this.recognition.onerror = () => this.vozError.set('La transcripción en vivo del navegador no está disponible; Whisper intentará transcribir al terminar.');
    try {
      this.recognition.start();
    } catch {
      this.vozError.set('No se pudo iniciar la transcripción en vivo.');
    }
  }

  private subirAudio(audio: Blob) {
    this.transcribiendoAudio.set(true);
    this.ai.transcribir(audio).subscribe({
      next: result => {
        const texto = result.texto.trim() || this.transcripcionEnVivo().trim();
        if (texto) {
          const previo = this.soapReq.transcripcion?.trim();
          this.soapReq.transcripcion = [previo, texto].filter(Boolean).join('\n');
        }
        this.vozError.set(result.mensaje);
        this.transcribiendoAudio.set(false);
      },
      error: () => {
        const texto = this.transcripcionEnVivo().trim();
        if (texto) this.soapReq.transcripcion = [this.soapReq.transcripcion?.trim(), texto].filter(Boolean).join('\n');
        this.vozError.set('No se pudo enviar el audio a Whisper. Se conservó la transcripción del navegador, si estaba disponible.');
        this.transcribiendoAudio.set(false);
      }
    });
  }

  preciosAnalizar() {
    const precio = Number(this.preciosPrecioTxt);
    if (!this.preciosReq.medicamento.trim() || isNaN(precio) || precio <= 0) {
      this.error.set('Escriba el medicamento y un precio positivo.');
      return;
    }
    this.error.set('');
    this.preciosReq.precioReportado = precio;
    this.preciosLoading.set(true);
    this.ai.precios(this.preciosReq).subscribe({
      next: r => this.preciosRsp.set(r),
      error: () => this.error.set('Error al triangular precios. Reintente.'),
      complete: () => this.preciosLoading.set(false)
    });
  }

  severidadColor(sev?: string): string {
    switch ((sev || '').toUpperCase()) {
      case 'ALTO': return 'bg-red';
      case 'MEDIO': return 'bg-orange';
      case 'BAJO': return 'bg-green';
      default: return 'bg-blue';
    }
  }

  irA(tab: MedicoTab, sub: MedicoSub = '') {
    this.onNavigate({ id: tab, label: '', tab, sub });
  }

  iniciales(nombre?: string): string {
    const parts = (nombre || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'M';
    return parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');
  }

  apellido(): string {
    const parts = (this.auth.user()?.nombre || this.perfil()?.nombre || '').trim().split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : (parts[0] || 'doctor');
  }

  saludo(): string {
    const hora = new Date().getHours();
    const momento = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
    return `${momento}, ${this.apellido()}`;
  }

  citasActivas(): Cita[] {
    return this.citas().filter(c => !['CANCELADA', 'RECHAZADA'].includes(c.estado));
  }

  especialidadHoy(): string {
    const hoy = this.citasDeHoy();
    const primera = hoy[0]?.medicoEspecialidad || this.perfil()?.especialidad;
    if (!primera) return 'Sin especialidad registrada';
    return hoy.length ? `${hoy.length} en ${primera}` : primera;
  }

  citasDeHoy(): Cita[] {
    const hoy = new Date().toDateString();
    return this.citasActivas().filter(c => new Date(c.fechaHora).toDateString() === hoy);
  }

  triagePrioritario(): Cita[] {
    return this.citasActivas()
      .filter(c => c.triageSeveridad || c.triagePrioridad)
      .sort((a, b) => (b.triagePrioridad ?? 0) - (a.triagePrioridad ?? 0))
      .slice(0, 4);
  }

  etiquetaPrioridad(c: Cita): string {
    const sev = (c.triageSeveridad || '').toUpperCase();
    if (sev.includes('ROJO') || (c.triagePrioridad ?? 0) >= 8) return 'Urgente';
    if (sev.includes('NARANJA') || (c.triagePrioridad ?? 0) >= 6) return 'Alta';
    if (sev.includes('AMARILLO') || (c.triagePrioridad ?? 0) >= 4) return 'Media';
    return 'Baja';
  }

  prioridadChip(c: Cita): string {
    const etiqueta = this.etiquetaPrioridad(c).toLowerCase();
    return `prio ${etiqueta}`;
  }

  horaCorta(iso: string): string {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return '';
    return fecha.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  }

  iaEnAccion(): { label: string; detalle: string }[] {
    const citas = this.citas();
    const piel = citas.filter(c => c.dermatologiaScoreRiesgo != null).length;
    const triage = citas.filter(c => !!c.triageSeveridad).length;
    const soapListo = this.soapRsp() ? 1 : 0;
    return [
      { label: 'Análisis de imágenes', detalle: piel ? `${piel} evaluación(es) de piel en tus citas` : 'Aún no hay evaluaciones de piel' },
      { label: 'Triage recibido', detalle: triage ? `${triage} cita(s) con orientación previa` : 'Sin triage registrado' },
      { label: 'Nota SOAP', detalle: soapListo ? 'Hay un borrador SOAP generado en esta sesión' : 'Sin nota SOAP generada todavía' }
    ];
  }

  pacientesRecientes(): { nombre: string; iniciales: string; estado: string; hora: string }[] {
    const vistos = new Set<string>();
    return this.citasActivas()
      .slice()
      .sort((a, b) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime())
      .filter(c => {
        if (vistos.has(c.pacienteNombre)) return false;
        vistos.add(c.pacienteNombre);
        return true;
      })
      .slice(0, 4)
      .map(c => ({
        nombre: c.pacienteNombre,
        iniciales: this.iniciales(c.pacienteNombre),
        estado: c.estado,
        hora: this.horaCorta(c.fechaHora)
      }));
  }

}
