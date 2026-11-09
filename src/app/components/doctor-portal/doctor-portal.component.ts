import { Component, inject, OnDestroy, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { DoctorService, DoctorDashboard, DoctorProfile } from '../../services/doctor.service';
import { Appointment, etiquetaCita, formatColombia, formatAppointmentWhen, visitClock } from '../../models/appointment.model';
import { Schedule } from '../../models/schedule.model';
import { PatientProfile } from '../../models/patient-profile.model';
import { PortalSidebarComponent, SidebarItem } from '../portal-sidebar/portal-sidebar.component';
import { SessionTimeoutComponent } from '../session-timeout/session-timeout.component';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';
import { AiService } from '../../services/ai.service';
import {
  AiSoapRequest, AiSoapResponse,
  AiPricesRequest, AiPricesResponse
} from '../../models/ai.model';

type MedicoTab = 'inicio' | 'citas' | 'horarios' | 'paciente' | 'soap' | 'precios';
type MedicoSub = '' | 'todas' | 'pendientes' | 'aceptadas' | 'historial' | 'lista' | 'agregar';

@Component({
  selector: 'app-doctor-portal',
  standalone: true,
  imports: [FormsModule, DecimalPipe, PortalSidebarComponent, SessionTimeoutComponent, NotificationBellComponent],
  templateUrl: './doctor-portal.component.html',
  styleUrl: './doctor-portal.component.css'
})
export class DoctorPortalComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  private svc = inject(DoctorService);
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
        { id: 'c-acep', label: 'Aceptadas', tab: 'citas', sub: 'aceptadas' },
        { id: 'c-hist', label: 'Historial', tab: 'citas', sub: 'historial' }
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
      label: 'Escriba',
      icon: '🤖',
      children: [
        { id: 'ia-soap', label: 'Consulta', tab: 'soap' }
      ]
    },
    {
      id: 'meds',
      label: 'Medicamentos',
      icon: '💊',
      children: [
        { id: 'meds-precios', label: 'Precios en Colombia', tab: 'precios' }
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

  dashboard = signal<DoctorDashboard | null>({
    totalCitas: 0, citasPendientes: 0, citasAceptadas: 0, citasHoy: 0, horariosActivos: 0
  });
  profile = signal<DoctorProfile | null>(null);
  citas = signal<Appointment[]>([]);
  horarios = signal<Schedule[]>([]);
  pacienteSeleccionado = signal<PatientProfile | null>(null);
  citaEnRevision = signal<Appointment | null>(null);
  historialPaciente = signal<Appointment[]>([]);

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
  consentimientoSoapAi = false;

  preciosReq: AiPricesRequest = {
    medicamento: '',
    presentacion: '',
    ciudad: ''
  };
  dialogo: { quien: 'medico' | 'paciente' | 'pista'; texto: string }[] = [];
  preguntaSim = '';
  sugeridos: string[] = [];
  elegidos: string[] = [];
  extraMed = '';
  cuidadosEnvio = '';
  resumenEnvio = '';
  consultaLoading = signal(false);
  avisoEnviando = signal(false);
  avisoOk = signal('');
  visitClosed = signal(false);
  private citasCerradas = signal<number[]>([]);
  preciosPrecioTxt = '';
  preciosRsp = signal<AiPricesResponse | null>(null);
  preciosLoading = signal(false);

  ngOnInit() {
    this.loadHome();
    this.loadAppointments();
    this.loadSchedules();
    this.svc.profile().subscribe({ next: p => this.profile.set(p) });
  }

  ngOnDestroy() {
    this.stopSoapSpeech();
  }

  onNavigate(item: SidebarItem) {
    if (!item.tab) return;
    this.tab.set(item.tab as MedicoTab);
    this.sub.set((item.sub ?? '') as MedicoSub);
    if (item.tab === 'citas') this.applyFilterFromSub(item.sub);
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

  private applyFilterFromSub(sub?: string) {
    if (sub === 'pendientes') this.filtroEstado = 'PENDIENTE';
    else if (sub === 'aceptadas') this.filtroEstado = 'ACEPTADA';
    else if (sub === 'historial') this.filtroEstado = 'HISTORIAL';
    else this.filtroEstado = '';
  }

  filtroEstado = '';

  pageTitle(): string {
    const map: Record<string, string> = {
      inicio: 'Panel médico',
      'citas-todas': 'Citas — todas',
      'citas-pendientes': 'Citas — pendientes',
      'citas-aceptadas': 'Citas — aceptadas',
      'citas-historial': 'Historial de pacientes',
      'horarios-lista': 'Horarios — listado',
      'horarios-agregar': 'Horarios — agregar',
      paciente: 'Ficha del paciente',
      soap: 'Escriba médico',
      precios: 'Precios'
    };
    const key = this.sub() ? `${this.tab()}-${this.sub()}` : this.tab();
    return map[key] ?? 'Portal médico';
  }

  loadHome() {
    this.svc.dashboard().subscribe({ next: d => this.dashboard.set(d) });
  }

  visitFinished(c: Appointment): boolean {
    return c.estado === 'COMPLETADA' || !!c.receta?.trim() || this.citasCerradas().includes(c.id);
  }

  filteredAppointments(): Appointment[] {
    if (this.filtroEstado === 'HISTORIAL') {
      return this.citas().filter(c => this.visitFinished(c));
    }
    const vigentes = this.citas().filter(c => !['CANCELADA', 'RECHAZADA'].includes(c.estado));
    if (!this.filtroEstado) return vigentes;
    return vigentes.filter(c => !this.visitFinished(c) && c.estado === this.filtroEstado);
  }

  loadAppointments() {
    this.svc.myAppointments().subscribe({
      next: c => this.citas.set(c),
      error: () => this.error.set('Error al cargar citas')
    });
  }

  loadSchedules() {
    this.svc.mySchedules().subscribe({ next: h => this.horarios.set(h) });
  }

  accept(id: number) {
    this.svc.accept(id).subscribe({ next: () => { this.loadAppointments(); this.loadHome(); } });
  }

  reject(id: number) {
    this.svc.reject(id).subscribe({ next: () => { this.loadAppointments(); this.loadHome(); } });
  }

  viewPatient(citaId: number) {
    this.historialPaciente.set([]);
    this.svc.myAppointments().subscribe({
      next: lista => {
        this.citas.set(lista);
        this.openChart(citaId);
      },
      error: () => this.openChart(citaId)
    });
  }

  private openChart(citaId: number) {
    const encontrada = this.citas().find(c => c.id === citaId) ?? null;
    const cerrada = !!encontrada && (
      encontrada.estado === 'COMPLETADA' || !!encontrada.receta?.trim() || this.citasCerradas().includes(citaId)
    );
    this.citaEnRevision.set(cerrada && encontrada ? { ...encontrada, estado: 'COMPLETADA' } : encontrada);
    this.svc.viewPatient(citaId).subscribe({
      next: p => {
        this.pacienteSeleccionado.set(p);
        /* Prefill SOAP from the patient file and triage. */
        const cita = this.citaEnRevision();
        this.soapReq.nombrePaciente = p.nombre;
        this.soapReq.motivoInicial = cita?.motivo || cita?.triageSintomas || '';
        if ((cita?.triageResumen || cita?.triageSintomas || cita?.motivo) && !this.soapReq.transcripcion) {
          this.soapReq.transcripcion = [
            cita?.triageSintomas ? `Síntomas que refirió: ${cita.triageSintomas}` : '',
            cita?.triageDuracion ? `Desde hace: ${cita.triageDuracion}` : '',
            cita?.triageAntecedentes ? `Antecedentes: ${cita.triageAntecedentes}` : '',
            cita?.triageResumen ? `Relato: ${cita.triageResumen}` : '',
            cita?.dermatologiaReportaIa ? `Piel: ${cita.dermatologiaReportaIa}` : '',
            '',
            '--- Lo que se dice en la consulta ---',
            ''
          ].filter(linea => linea !== undefined).join('\n');
        }
        this.svc.patientHistory(citaId).subscribe({
          next: historial => this.historialPaciente.set(historial),
          error: () => this.error.set('No se pudo cargar el historial previo del paciente.')
        });
        this.tab.set('paciente');
        this.sub.set('');
      }
    });
  }

  addSchedule() {
    this.svc.createSchedule({
      diaSemana: this.diaSemana,
      horaInicio: this.horaInicio,
      horaFin: this.horaFin,
      disponible: true
    }).subscribe({
      next: () => {
        this.loadSchedules();
        this.loadHome();
        this.sub.set('lista');
        this.tab.set('horarios');
      }
    });
  }

  deleteSchedule(id: number) {
    this.svc.deleteSchedule(id).subscribe({ next: () => this.loadSchedules() });
  }

  statusLabel(c: Appointment) {
    if (this.visitFinished(c)) return 'Cita ya terminada';
    return etiquetaCita(c);
  }

  badgeClass(estado: string): string {
    return 'badge badge-' + estado.toLowerCase();
  }

  soapGenerar() {
    if (!this.consentimientoSoapAi) {
      this.error.set('Confirma que el paciente autorizó el envío de la transcripción al servicio de IA.');
      return;
    }
    const tx = this.ensureNarrative();
    if (!tx) {
      this.error.set('El cuadro está vacío. El texto gris era solo un ejemplo. Escribe el relato o abre al paciente desde su cita.');
      return;
    }
    this.soapReq.transcripcion = tx;
    this.soapReq.transcripcionConsulta = tx;
    this.error.set('');
    this.soapLoading.set(true);
    this.ai.soap(this.soapReq).subscribe({
      next: r => {
        this.soapRsp.set(r);
        if (!this.resumenEnvio) this.resumenEnvio = r.resumenParaMedico || '';
        if (!this.cuidadosEnvio) this.cuidadosEnvio = r.cuidados || '';
        this.mergeSuggestions(this.linesOf(r.medicamentosSugeridos));
        this.speakSoapSummary(r);
      },
      complete: () => this.soapLoading.set(false)
    });
  }

  speakSoapSummary(r?: AiSoapResponse) {
    const nota = r ?? this.soapRsp();
    if (!nota || typeof speechSynthesis === 'undefined') return;
    const texto = [
      `Resumen de ${this.soapReq.nombrePaciente || 'la consulta'}.`,
      nota.resumenParaMedico || '',
      nota.enfoqueEnConsulta ? `Qué revisar ahora: ${nota.enfoqueEnConsulta}` : '',
      nota.preguntasSugeridas ? `Pregúntale: ${nota.preguntasSugeridas}` : '',
      nota.medicamentosSugeridos ? `Medicamentos a considerar: ${nota.medicamentosSugeridos}` : '',
      nota.cuidados ? `Cuidados: ${nota.cuidados}` : ''
    ].filter(Boolean).join('. ');
    speechSynthesis.cancel();
    const voz = new SpeechSynthesisUtterance(texto.slice(0, 1400));
    voz.lang = 'es-CO';
    voz.rate = 0.95;
    const es = speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith('es'));
    if (es) voz.voice = es;
    speechSynthesis.speak(voz);
  }

  private ensureNarrative(): string {
    const escrito = (this.soapReq.transcripcion || this.soapReq.transcripcionConsulta || '').trim();
    if (escrito) {
      this.soapReq.transcripcion = escrito;
      return escrito;
    }
    const cita = this.citaEnRevision();
    const deCita = [
      cita?.motivo ? `Motivo: ${cita.motivo}` : '',
      cita?.triageSintomas ? `Síntomas: ${cita.triageSintomas}` : '',
      cita?.triageDuracion ? `Desde hace: ${cita.triageDuracion}` : '',
      cita?.triageAntecedentes ? `Antecedentes: ${cita.triageAntecedentes}` : '',
      cita?.triageResumen || '',
      cita?.dermatologiaReportaIa ? `Piel: ${cita.dermatologiaReportaIa}` : ''
    ].filter(Boolean).join('\n');
    const relato = deCita || (this.soapReq.motivoInicial || '').trim();
    if (relato) this.soapReq.transcripcion = relato;
    return relato;
  }

  stopSoapSpeech() {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }

  estimatePrices() {
    if (!this.preciosReq.medicamento.trim() || !this.preciosReq.ciudad?.trim()) {
      this.error.set('Escribe el medicamento y la ciudad. Con eso basta.');
      return;
    }
    const precio = Number(this.preciosPrecioTxt);
    this.preciosReq.precioReportado = !isNaN(precio) && precio > 0 ? precio : undefined;
    this.error.set('');
    this.preciosLoading.set(true);
    this.ai.estimatePrices(this.preciosReq).subscribe({
      next: r => this.preciosRsp.set(r),
      error: () => this.error.set('No se pudo estimar el precio. Inténtalo otra vez.'),
      complete: () => this.preciosLoading.set(false)
    });
  }

  linesOf(texto?: string): string[] {
    if (!texto) return [];
    return texto.split(/\n|•/).map(s => s.replace(/^[\s\-\d\.\)]+/, '').trim()).filter(Boolean);
  }

  chosen(m: string) {
    return this.elegidos.includes(m);
  }

  toggleMedication(m: string) {
    this.elegidos = this.chosen(m) ? this.elegidos.filter(x => x !== m) : [...this.elegidos, m];
  }

  addDoctorItem() {
    const m = this.extraMed.trim();
    if (!m) return;
    this.mergeSuggestions([m]);
    if (!this.elegidos.includes(m)) this.elegidos = [...this.elegidos, m];
    this.extraMed = '';
  }

  private mergeSuggestions(meds: string[]) {
    for (const m of meds) {
      if (m && !this.sugeridos.includes(m)) this.sugeridos = [...this.sugeridos, m];
    }
  }

  goToConsult() {
    if (this.visitAlreadyDone()) return;
    this.tab.set('soap');
    this.sub.set('');
  }

  visitAlreadyDone(): boolean {
    const cita = this.citaEnRevision();
    return !!cita && this.visitFinished(cita);
  }

  visitsForThisDoctor(): Appointment[] {
    const yo = this.profile()?.id;
    const propias = this.historialPaciente().filter(c => yo != null && c.medicoId === yo);
    const actual = this.citaEnRevision();
    if (actual && !propias.some(c => c.id === actual.id)) {
      return [actual, ...propias];
    }
    return propias;
  }

  startConsult() {
    if (!this.consentimientoSoapAi) {
      this.error.set('Marca la autorización antes de iniciar la simulación.');
      return;
    }
    const ctx = this.ensureNarrative();
    if (!ctx) {
      this.error.set('El cuadro está vacío. Escribe el relato o abre al paciente desde su cita, y luego inicia la consulta.');
      return;
    }
    const motivo = this.soapReq.motivoInicial?.trim() || 'lo que te conté';
    const dias = (this.soapReq.transcripcion || '').match(/(\d+)\s*d[ií]as/);
    this.dialogo = [{
      quien: 'paciente',
      texto: `Doctor, buenos días. Vengo porque ${motivo}.${dias ? ` Llevo así como ${dias[1]} días.` : ''}`
    }];
    this.preguntaSim = '';
    this.avisoOk.set('');
    this.visitClosed.set(false);
    this.error.set('');
  }

  askSimulation(pregunta: string) {
    const texto = pregunta.trim();
    if (texto) this.dialogo = [...this.dialogo, { quien: 'medico', texto }];
    this.consultaLoading.set(true);
    this.ai.simulateVisit({
      nombrePaciente: this.soapReq.nombrePaciente,
      motivo: this.soapReq.motivoInicial,
      contexto: this.soapReq.transcripcion,
      pregunta: texto,
      dialogo: this.dialogo
        .filter(d => d.quien === 'medico' || d.quien === 'paciente')
        .map(d => `${d.quien === 'medico' ? 'Médico' : 'Paciente'}: ${d.texto}`)
    }).subscribe({
      next: r => {
        this.dialogo = [...this.dialogo, { quien: 'paciente' as const, texto: r.dicePaciente }];
        this.mergeSuggestions(this.linesOf(r.medicamentosSugeridos));
        if (!this.cuidadosEnvio && r.cuidados) this.cuidadosEnvio = r.cuidados;
        if (!this.resumenEnvio && this.soapRsp()?.resumenParaMedico) {
          this.resumenEnvio = this.soapRsp()!.resumenParaMedico || '';
        }
      },
      error: () => this.error.set('No se pudo continuar la simulación.'),
      complete: () => this.consultaLoading.set(false)
    });
  }

  sendQuestion() {
    const texto = this.preguntaSim.trim();
    if (!texto || this.consultaLoading()) return;
    this.preguntaSim = '';
    this.askSimulation(texto);
  }

  notifyPatient() {
    const cita = this.citaEnRevision();
    if (!cita) {
      this.error.set('Abre al paciente desde su cita para poder dejarle el aviso.');
      return;
    }
    if (this.extraMed.trim()) this.addDoctorItem();
    const medicamentos = this.elegidos.join('; ');
    if (!medicamentos && !this.cuidadosEnvio.trim()) {
      this.error.set('Elige al menos un medicamento o escribe qué debe hacer.');
      return;
    }
    this.error.set('');
    this.avisoOk.set('');
    this.avisoEnviando.set(true);
    this.svc.sendPrescription(cita.id, {
      resumen: this.resumenEnvio || this.soapRsp()?.resumenParaMedico || this.soapReq.motivoInicial,
      medicamentos,
      cuidados: this.cuidadosEnvio
    }).subscribe({
      next: r => {
        this.visitClosed.set(true);
        this.citasCerradas.update(ids => ids.includes(cita.id) ? ids : [...ids, cita.id]);
        this.avisoOk.set('');
        this.stopSoapSpeech();
        this.soapRsp.set(null);
        this.dialogo = [];
        this.sugeridos = [];
        this.elegidos = [];
        this.extraMed = '';
        this.cuidadosEnvio = '';
        this.preguntaSim = '';
        this.soapReq.transcripcion = '';
        this.soapReq.transcripcionConsulta = '';
        const cerrada = { ...cita, estado: 'COMPLETADA' as const };
        this.citaEnRevision.set(cerrada);
        this.citas.update(lista => lista.map(c => c.id === cita.id ? cerrada : c));
        this.loadAppointments();
      },
      error: () => this.error.set('No se pudo enviar el aviso. Publica el backend en Render y vuelve a intentarlo.'),
      complete: () => this.avisoEnviando.set(false)
    });
  }

  severityColor(sev?: string): string {
    switch ((sev || '').toUpperCase()) {
      case 'ALTO': return 'bg-red';
      case 'MEDIO': return 'bg-orange';
      case 'BAJO': return 'bg-green';
      default: return 'bg-blue';
    }
  }

  goTo(tab: MedicoTab, sub: MedicoSub = '') {
    this.onNavigate({ id: tab, label: '', tab, sub });
  }

  initials(nombre?: string): string {
    const parts = (nombre || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'M';
    return parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');
  }

  lastName(): string {
    const parts = (this.auth.user()?.nombre || this.profile()?.nombre || '').trim().split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : (parts[0] || 'doctor');
  }

  greeting(): string {
    const hora = new Date().getHours();
    const momento = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
    return `${momento}, ${this.lastName()}`;
  }

  activeAppointments(): Appointment[] {
    return this.citas().filter(c => !this.visitFinished(c) && !['CANCELADA', 'RECHAZADA'].includes(c.estado));
  }

  completedCount(): number {
    return this.citas().filter(c => this.visitFinished(c)).length;
  }

  specialtyToday(): string {
    const hoy = this.appointmentsToday();
    const primera = hoy[0]?.medicoEspecialidad || this.profile()?.especialidad;
    if (!primera) return 'Sin especialidad registrada';
    return hoy.length ? `${hoy.length} en ${primera}` : primera;
  }

  appointmentsToday(): Appointment[] {
    const hoy = new Date().toDateString();
    return this.activeAppointments().filter(c => new Date(c.fechaHora).toDateString() === hoy);
  }

  priorityTriage(): Appointment[] {
    return this.activeAppointments()
      .filter(c => c.triageSeveridad || c.triagePrioridad)
      .sort((a, b) => (b.triagePrioridad ?? 0) - (a.triagePrioridad ?? 0))
      .slice(0, 4);
  }

  priorityLabel(c: Appointment): string {
    const sev = (c.triageSeveridad || '').toUpperCase();
    if (sev.includes('ROJO') || (c.triagePrioridad ?? 0) >= 8) return 'Urgente';
    if (sev.includes('NARANJA') || (c.triagePrioridad ?? 0) >= 6) return 'Alta';
    if (sev.includes('AMARILLO') || (c.triagePrioridad ?? 0) >= 4) return 'Media';
    return 'Baja';
  }

  priorityChip(c: Appointment): string {
    const statusLabel = this.priorityLabel(c).toLowerCase();
    return `prio ${statusLabel}`;
  }

  readonly formatColombia = formatColombia;
  readonly formatAppointmentWhen = formatAppointmentWhen;

  shortTime(iso: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso || '');
    if (!match) return '';
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
    return date.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  }

  iaEnAccion(): { label: string; detalle: string }[] {
    const citas = this.activeAppointments();
    const piel = citas.filter(c => c.dermatologiaScoreRiesgo != null).length;
    const triage = citas.filter(c => !!c.triageSeveridad).length;
    const soapListo = this.soapRsp() ? 1 : 0;
    return [
      { label: 'Análisis de imágenes', detalle: piel ? `${piel} evaluación(es) de piel en tus citas` : 'Aún no hay evaluaciones de piel' },
      { label: 'Triage recibido', detalle: triage ? `${triage} cita(s) con orientación previa` : 'Sin triage registrado' },
      { label: 'Nota SOAP', detalle: soapListo ? 'Hay un borrador SOAP generado en esta sesión' : 'Sin nota SOAP generada todavía' }
    ];
  }

  recentPatients(): { nombre: string; initials: string; estado: string; hora: string }[] {
    const vistos = new Set<string>();
    return this.citas()
      .filter(c => !['CANCELADA', 'RECHAZADA'].includes(c.estado))
      .slice()
      .sort((a, b) => new Date(b.fechaHora).getTime() - new Date(a.fechaHora).getTime())
      .filter(c => {
        const clave = `${c.pacienteId || c.pacienteNombre}`;
        if (vistos.has(clave)) return false;
        vistos.add(clave);
        return true;
      })
      .map(c => ({
        nombre: c.pacienteNombre,
        initials: this.initials(c.pacienteNombre),
        estado: this.statusLabel(c),
        hora: this.shortTime(visitClock(c))
      }));

/** Doctor portal: agenda, consult, and send visit. */
  }

}
