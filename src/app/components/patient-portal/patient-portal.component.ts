import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { PatientService } from '../../services/patient.service';
import { AiService } from '../../services/ai.service';
import { Appointment, etiquetaCita, formatColombia, formatSlotColombia, formatAppointmentWhen, isFutureSlot } from '../../models/appointment.model';
import { Notification } from '../../models/notification.model';
import { User } from '../../models/user.model';
import { CupoDisponible, Schedule } from '../../models/schedule.model';
import { PatientDashboard, PatientProfile } from '../../models/patient-profile.model';
import {
  AiDermatologyRequest, AiDermatologyResponse,
  AiInteractionRequest, AiInteractionResponse,
  AiPricesRequest, AiPricesResponse,
  AiTriageRequest, AiTriageResponse
} from '../../models/ai.model';
import { PortalSidebarComponent, SidebarItem } from '../portal-sidebar/portal-sidebar.component';
import {
  GENDERS, BLOOD_TYPES, phoneMessage, normalizeGender, normalizeBloodType, idDigitsOnly, digitsOnly, isColombianPhone
} from '../../data/person-data';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';
import { NotificationService } from '../../services/notification.service';
import { LiveService } from '../../services/live.service';

type PacienteTab = 'inicio' | 'agendar' | 'historial' | 'proximas' | 'medicos' | 'perfil'
  | 'triage' | 'dermatologia' | 'interacciones' | 'precios';
type PacienteSub = '' | 'agendar' | 'historial' | 'proximas' | 'directorio' | 'editar'
  | 'triage' | 'derm' | 'inter' | 'precios';

@Component({
  selector: 'app-patient-portal',
  standalone: true,
  imports: [FormsModule, PortalSidebarComponent, NotificationBellComponent],
  templateUrl: './patient-portal.component.html',
  styleUrl: './patient-portal.component.css'
})
export class PatientPortalComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  private avisos = inject(NotificationService);
  private live = inject(LiveService);
  private stopLive: (() => void) | null = null;
  private avisosReales = signal<{ titulo: string; detalle: string }[]>([]);
  private avisosInbox = signal<Notification[]>([]);
  recetaVisible = signal('');
  private svc = inject(PatientService);
  private ai = inject(AiService);

  readonly generos = GENDERS;
  readonly tiposSangre = BLOOD_TYPES;
  readonly digitsOnly = digitsOnly;
  readonly idDigitsOnly = idDigitsOnly;
  tab = signal<PacienteTab>('inicio');
  sub = signal<PacienteSub>('');
  expandedMenus = signal<string[]>(['citas', 'medicos', 'ia', 'medicamentos']);

  readonly menuItems: SidebarItem[] = [
    { id: 'inicio', label: 'Inicio', icon: '🏠', tab: 'inicio' },
    {
      id: 'citas',
      label: 'Mis citas',
      icon: '📅',
      children: [
        { id: 'c-agendar', label: 'Agendar cita', tab: 'agendar', sub: 'agendar' },
        { id: 'c-hist', label: 'Historial', tab: 'historial', sub: 'historial' },
        { id: 'c-prox', label: 'Próximas citas', tab: 'proximas', sub: 'proximas' }
      ]
    },
    {
      id: 'medicos',
      label: 'Médicos',
      icon: '🩺',
      children: [
        { id: 'm-dir', label: 'Directorio médicos', tab: 'medicos', sub: 'directorio' }
      ]
    },
    {
      id: 'ia',
      label: 'Orientación',
      icon: '🤖',
      children: [
        { id: 'm-inter', label: 'Interacciones fármaco-alimento', tab: 'interacciones', sub: 'inter' },
        { id: 'm-precios', label: 'Precios y farmacias', tab: 'precios', sub: 'precios' }
      ]
    },
    {
      id: 'perfil',
      label: 'Mi perfil',
      icon: '👤',
      children: [
        { id: 'p-edit', label: 'Editar perfil', tab: 'perfil', sub: 'editar' }
      ]
    }
  ];

  dashboard = signal<PatientDashboard | null>({
    totalCitas: 0, citasPendientes: 0, citasAceptadas: 0, citasCanceladas: 0, proximasCitas: 0
  });
  profile = signal<PatientProfile | null>(null);
  medicos = signal<User[]>([]);
  medicoDetalle = signal<User | null>(null);
  horarios = signal<Schedule[]>([]);
  cupos = signal<CupoDisponible[]>([]);
  avisoCita = signal('');
  citas = signal<Appointment[]>([]);
  proximas = signal<Appointment[]>([]);

  medicoId: number | null = null;
  fechaHora = '';
  motivo = '';
  sintomas = '';
  duracionSintomas = '';
  antecedentesSintomas = '';
  tieneLesionPiel = false;
  consentimientoTriage = false;
  filtroEspecialidad = '';
  dermFotoNombre = '';
  dermFotoPreview = signal<string | null>(null);
  avisoMedico = signal('');
  error = signal('');
  ok = signal('');
  loading = signal(false);
  guardandoPerfil = signal(false);

  /* Assistant: triage NLP */
  triageReq: AiTriageRequest = { sintomas: '', duracion: '', antecedentes: '' };
  triageRsp = signal<AiTriageResponse | null>(null);
  triageLoading = signal(false);

  /* Assistant: skin image review */
  dermReq: AiDermatologyRequest = { descripcion: '', tiempoEvolucion: '', sintomasAsociados: '' };
  dermRsp = signal<AiDermatologyResponse | null>(null);
  dermLoading = signal(false);

  /* Assistant: drug and food interactions */
  interMed = '';       /* comma list */
  interDieta = '';     /* comma list */
  interSuplem = '';    /* comma list */
  interRsp = signal<AiInteractionResponse | null>(null);
  interLoading = signal(false);

  /* Assistant: pharmacy prices */
  preciosReq: AiPricesRequest = { medicamento: '', presentacion: '', ciudad: '' };
  preciosPrecioTxt = '';
  preciosRsp = signal<AiPricesResponse | null>(null);
  preciosLoading = signal(false);

  ngOnInit() {
    this.loadHome();
    this.loadDoctors();
    this.loadHistory();
    this.loadProfileAndBackground();
    this.stopLive = this.live.watch(() => this.loadPrescription());
  }

  ngOnDestroy() {
    this.stopLive?.();
  }

  onNavigate(item: SidebarItem) {
    if (!item.tab) return;
    this.tab.set(item.tab as PacienteTab);
    this.sub.set((item.sub ?? '') as PacienteSub);
    this.error.set('');
    this.ok.set('');
    if (item.tab === 'perfil' || item.tab === 'agendar') this.loadProfileAndBackground();
    if (item.tab === 'interacciones' || item.tab === 'precios') this.loadPrescription();
    if (item.tab === 'proximas') this.svc.upcoming().subscribe({ next: c => this.proximas.set(c) });
    const group = this.menuItems.find(m => m.children?.some(c => c.id === item.id));
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

  pageTitle(): string {
    const map: Record<string, string> = {
      inicio: 'Panel del paciente',
      book: 'Agendar cita (triage + piel + médico)',
      historial: 'Historial de citas',
      proximas: 'Próximas citas',
      'medicos-directorio': 'Directorio de médicos',
      'perfil-editar': 'Mi perfil',
      'interacciones-inter': 'Interacciones fármaco-alimento',
      'precios-precios': 'Precios y farmacias'
    };
    const key = this.sub() ? `${this.tab()}-${this.sub()}` : this.tab();
    return map[key] ?? map[this.tab()] ?? 'Portal del paciente';
  }

  loadHome() {
    this.svc.dashboard().subscribe({ next: d => this.dashboard.set(d) });
    this.svc.upcoming().subscribe({ next: c => this.proximas.set(c) });
    this.avisos.list().subscribe({
      next: n => {
        this.avisosInbox.set(n);
        this.avisosReales.set(n.slice(0, 4).map(a => ({ titulo: a.titulo, detalle: a.mensaje })));
        this.applyPrescription();
      }
    });
  }

  loadProfile() {
    this.loadProfileAndBackground();
  }

  loadProfileAndBackground() {
    this.svc.profile().subscribe({
      next: p => {
        this.profile.set({
          ...p,
          telefono: digitsOnly(p.telefono || ''),
          telefonoEmergencia: digitsOnly(p.telefonoEmergencia || ''),
          documento: /^\d+$/.test((p.documento || '').trim()) ? idDigitsOnly(p.documento || '') : (p.documento || ''),
          genero: normalizeGender(p.genero || ''),
          tipoSangre: normalizeBloodType(p.tipoSangre || '')
        });
        if (!this.antecedentesSintomas) {
          this.antecedentesSintomas = [p.alergias, p.observaciones].filter(Boolean).join(' · ');
        }
      }
    });
  }

  loadDoctors() {
    this.svc.listDoctors().subscribe({ next: m => this.medicos.set(m) });
  }

  filteredDoctors(): User[] {
    const lista = this.medicos();
    const sugerida = (this.triageRsp()?.especialidadRecomendada || this.filtroEspecialidad).toLowerCase();
    if (!sugerida) return lista;
    return [...lista].sort((a, b) => {
      const am = a.especialidad?.toLowerCase().includes(sugerida) ? 0 : 1;
      const bm = b.especialidad?.toLowerCase().includes(sugerida) ? 0 : 1;
      return am - bm;
    });
  }

  canBook(): boolean {
    if (this.loading() || this.triageLoading() || this.dermLoading()) return false;
    if (!this.sintomas.trim() || !this.consentimientoTriage || !this.medicoId || !this.fechaHora) return false;
    if (!isFutureSlot(this.dateForApi())) return false;
    if (this.tieneLesionPiel && !this.canAnalyzeSkin()) return false;
    return true;
  }

  canAnalyzeSkin(): boolean {
    return !!(this.dermReq.descripcion?.trim() || this.dermReq.imagenBase64 || this.sintomas.trim());
  }

  onSkinToggle() {
    if (!this.tieneLesionPiel) {
      this.dermReq.descripcion = '';
      this.clearSkinPhoto();
      this.dermRsp.set(null);
    }
  }

  onSkinPhoto(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || /\.html?$/i.test(file.name)) {
      this.error.set('Ese archivo no es una foto. Sube un JPG, PNG o WEBP (no una página .htm).');
      return;
    }
    if (file.size > 8_000_000) {
      this.error.set('La foto debe pesar menos de 8 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 384;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        this.dermReq.imagenBase64 = canvas.toDataURL('image/jpeg', 0.82);
        this.dermFotoPreview.set(this.dermReq.imagenBase64);
        this.dermFotoNombre = file.name;
        this.dermRsp.set(null);
        this.error.set('');
      };
      img.onerror = () => {
        this.error.set('No se pudo leer la imagen. Elige otra foto JPG o PNG.');
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  clearSkinPhoto() {
    this.dermReq.imagenBase64 = undefined;
    this.dermFotoPreview.set(null);
    this.dermFotoNombre = '';
  }

  targetSpecialty(): string {
    const triageEsp = this.triageRsp()?.especialidadRecomendada || this.filtroEspecialidad || '';
    if (this.tieneLesionPiel && this.dermRsp()) {
      const riesgo = (this.dermRsp()!.nivelRiesgo || '').toUpperCase();
      const dx = (this.dermRsp()!.diagnosticosDiferenciales || []).join(' ').toLowerCase();
      const esPiel = /melanoma|dermatitis|acn[eé]|tiña|tinea|herpes|celulitis|imp[eé]tigo|urticaria|psoriasis|hongo/.test(dx);
      if (riesgo === 'ALTO' || riesgo === 'CRITICO' || esPiel) return 'Dermatología';
      if (triageEsp) return triageEsp;
      return 'Dermatología';
    }
    return triageEsp;
  }

  assignedDoctor(): User | null {
    return this.medicos().find(m => m.id === this.medicoId) ?? null;
  }

  assignDoctorFromAnalysis() {
    const esp = this.targetSpecialty();
    if (!esp) return;
    const lista = this.medicos();
    const n = (s?: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const target = n(esp);
    const match = lista.find(m => n(m.especialidad) === target)
      || lista.find(m => {
        const e = n(m.especialidad);
        return e.includes(target) || target.includes(e);
      });
    if (match) {
      this.medicoId = match.id;
      this.avisoMedico.set(`Médico asignado según el análisis: ${match.nombre} — ${match.especialidad}.`);
      this.onDoctorChange();
      return;
    }
    this.avisoMedico.set(
      `No hay un médico de ${esp} en el directorio. El administrador puede crearlo en Inteligencia Artificial → Registro Hospy (especialidad ${esp}). Mientras tanto puedes elegir otro médico.`
    );
  }

  private dateForApi(): string {
    const f = this.fechaHora;
    if (!f) return '';
    return f.length === 16 ? `${f}:00` : f;
  }

  viewDoctor(m: User) {
    this.medicoDetalle.set(m);
    this.tab.set('medicos');
    this.sub.set('directorio');
    this.svc.doctorSchedules(m.id).subscribe({ next: h => this.horarios.set(h) });
  }

  onDoctorChange() {
    this.fechaHora = '';
    this.cupos.set([]);
    this.avisoCita.set('');
    if (!this.medicoId) {
      this.horarios.set([]);
      return;
    }
    this.avisoCita.set('Buscando el próximo cupo…');
    this.svc.doctorSchedules(this.medicoId).subscribe({ next: h => this.horarios.set(h) });
    this.svc.doctorSlots(this.medicoId).subscribe({
      next: c => {
        const futuros = c.filter(slot => isFutureSlot(slot.fechaHora));
        this.cupos.set(futuros);
        if (futuros.length) {
          this.chooseSlot(futuros[0]);
          this.avisoCita.set('Cupo asignado: ' + this.slotLabel(futuros[0]) + '.');
        } else {
          this.avisoCita.set('Este médico no tiene cupos en las próximas semanas.');
        }
      },
      error: () => {
        this.cupos.set([]);
        this.avisoCita.set('No se pudieron cargar los cupos. Elige otro médico o recarga.');
      }
    });
  }

  chooseSlot(c: CupoDisponible) {
    if (!isFutureSlot(c.fechaHora)) return;
    this.fechaHora = this.toDatetimeLocal(c.fechaHora);
  }

  slotLabel(c: CupoDisponible): string {
    return formatSlotColombia(c.fechaHora) || c.etiqueta;
  }

  slotSelected(c: CupoDisponible): boolean {
    return this.toDatetimeLocal(c.fechaHora) === this.fechaHora;
  }

  readonly formatColombia = formatColombia;
  readonly formatAppointmentWhen = formatAppointmentWhen;

  toDatetimeLocal(iso: string): string {
    const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(iso || '');
    return match ? `${match[1]}T${match[2]}` : '';
  }

  dayName(n: number): string {
    return ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][n] || `Día ${n}`;
  }

  shortTime(h: string): string {
    return (h || '').slice(0, 5);
  }

  loadHistory() {
    this.svc.history().subscribe({
      next: c => {
        this.citas.set(c);
        this.applyPrescription();
      }
    });
  }

  book() {
    if (!this.canBook()) {
      this.error.set(this.fechaHora && !isFutureSlot(this.dateForApi())
        ? 'Ese horario ya pasó. Elige un cupo de hoy en adelante.'
        : 'Completa los campos obligatorios (*). La piel solo es obligatoria si marcaste que tienes una lesión.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const enviar = () => {
      const triage = this.triageRsp();
      const dermatologia = this.tieneLesionPiel ? this.dermRsp() : null;
      this.svc.bookAppointment({
        medicoId: this.medicoId!,
        fechaHora: this.dateForApi(),
        motivo: this.motivo || this.sintomas,
        triageSeveridad: triage?.severidad,
        triageNivelEsi: triage?.nivelEsi,
        triagePrioridad: triage?.prioridad,
        triageEspecialidadSugerida: triage?.especialidadRecomendada,
        triageResumen: triage?.resumen,
        triageSintomas: this.sintomas,
        triageDuracion: this.duracionSintomas,
        triageAntecedentes: this.antecedentesSintomas,
        dermatologiaReportaIa: dermatologia
          ? `${dermatologia.advertencia} ${dermatologia.recomendaciones} Diferenciales: ${dermatologia.diagnosticosDiferenciales.join(', ')}`
          : undefined,
        dermatologiaScoreRiesgo: dermatologia?.scoreRiesgo,
        dermatologiaTopDiagnostico: dermatologia?.diagnosticosDiferenciales[0]
      }).subscribe({
        next: (cita) => {
          this.loading.set(false);
          this.ok.set(cita.avisoAgenda
            ? `Cita agendada. ${cita.avisoAgenda}`
            : 'Cita agendada. El médico recibe el resumen de IA y tu historial por correo (si SMTP está activo).');
          this.fechaHora = '';
          this.motivo = '';
          this.sintomas = '';
          this.duracionSintomas = '';
          this.antecedentesSintomas = '';
          this.consentimientoTriage = false;
          this.triageRsp.set(null);
          this.dermRsp.set(null);
          this.tieneLesionPiel = false;
          this.clearSkinPhoto();
          this.avisoMedico.set('');
          this.loadHome();
          this.loadHistory();
          this.tab.set('historial');
          this.sub.set('historial');
        },
        error: (e) => {
          this.loading.set(false);
          this.error.set(e.error?.error ?? 'Error al agendar');
        }
      });
    };

    const despuesTriage = () => {
      if (this.tieneLesionPiel && this.canAnalyzeSkin() && !this.dermRsp()) {
        this.ai.dermatology(this.dermatologyPayload()).subscribe({
          next: r => {
            this.dermRsp.set(r);
            this.assignDoctorFromAnalysis();
            enviar();
          },
          error: () => enviar()
        });
        return;
      }
      enviar();
    };

    if (!this.triageRsp()) {
      this.triageReq = this.triagePayload();
      this.ai.triage({ ...this.triageReq }).subscribe({
        next: r => { this.triageRsp.set(r); despuesTriage(); },
        error: () => despuesTriage()
      });
      return;
    }
    despuesTriage();
  }

  saveProfile() {
    const actual = this.profile();
    if (!actual) return;
    const p = {
      ...actual,
      telefono: digitsOnly(actual.telefono || ''),
      telefonoEmergencia: digitsOnly(actual.telefonoEmergencia || ''),
      documento: idDigitsOnly(actual.documento || '') || actual.documento || ''
    };
    this.profile.set(p);
    if (!isColombianPhone(p.telefono || '')) {
      this.error.set(phoneMessage('El teléfono'));
      return;
    }
    if (!isColombianPhone(p.telefonoEmergencia || '')) {
      this.error.set(phoneMessage('El teléfono de emergencia'));
      return;
    }
    this.error.set('');
    this.guardandoPerfil.set(true);
    this.svc.updateProfile(p).subscribe({
      next: (res) => {
        this.profile.set({
          ...res,
          telefono: digitsOnly(res.telefono || ''),
          telefonoEmergencia: digitsOnly(res.telefonoEmergencia || ''),
          genero: normalizeGender(res.genero || ''),
          tipoSangre: normalizeBloodType(res.tipoSangre || '')
        });
        this.guardandoPerfil.set(false);
        this.ok.set('Perfil actualizado');
      },
      error: (e) => {
        this.guardandoPerfil.set(false);
        this.error.set(e.error?.error ?? 'Error al guardar');
      }
    });
  }

  cancelVisit(id: number) {
    if (!confirm('¿Cancelar esta cita?')) return;
    this.svc.cancelAppointment(id).subscribe({
      next: () => { this.loadHistory(); this.loadHome(); },
      error: (e) => this.error.set(e.error?.error ?? 'Error')
    });
  }

  bookWithDoctor(m: User) {
    this.medicoId = m.id;
    this.medicoDetalle.set(null);
    this.tab.set('agendar');
    this.sub.set('agendar');
    this.onDoctorChange();
  }

  /* ============ Inteligencia Artificial ============ */
  runTriage() {
    if (!this.consentimientoTriage) {
      this.error.set('Autoriza el envío de tus datos de salud para continuar.');
      return;
    }
    /* En la tab de agendar se usan campos sueltos; en standalone se usa triageReq */
    const sintomasVal = this.tab() === 'agendar' ? this.sintomas.trim() : (this.triageReq.sintomas || this.sintomas).trim();
    if (!sintomasVal) {
      this.error.set('Describe tus síntomas para analizar el triage.');
      return;
    }
    this.triageLoading.set(true);
    this.error.set('');
    this.triageRsp.set(null);

    /* Sincronizar en ambas direcciones */
    if (this.tab() === 'agendar') {
      this.triageReq = this.triagePayload();
    } else {
      this.sintomas = this.triageReq.sintomas || '';
      this.duracionSintomas = this.triageReq.duracion || '';
      this.antecedentesSintomas = this.triageReq.antecedentes || '';
      this.triageReq = this.triagePayload();
    }

    this.ai.triage({ ...this.triageReq }).subscribe({
      next: (r) => {
        this.triageRsp.set(r);
        this.triageLoading.set(false);
        this.filtroEspecialidad = r.especialidadRecomendada || '';
        this.assignDoctorFromAnalysis();
        if (this.tieneLesionPiel && this.canAnalyzeSkin()) this.runDermatology();
      }
    });
  }

  runDermatology() {
    if (!this.canAnalyzeSkin()) {
      this.error.set('Describe la lesión o sube una foto de evidencia.');
      return;
    }
    this.dermLoading.set(true);
    this.error.set('');
    this.dermRsp.set(null);
    this.ai.dermatology(this.dermatologyPayload()).subscribe({
      next: (r) => {
        this.dermRsp.set(r);
        this.dermLoading.set(false);
        this.assignDoctorFromAnalysis();
      }
    });
  }

  private triagePayload(): AiTriageRequest {
    const sintomas = (this.tab() === 'agendar' ? this.sintomas : (this.triageReq.sintomas || this.sintomas)).trim();
    const lesion = this.tieneLesionPiel ? (this.dermReq.descripcion || '').trim() : '';
    const sintomasCompletos = lesion ? `${sintomas}\nTambién refiere en la piel: ${lesion}` : sintomas;
    return {
      sintomas: sintomasCompletos,
      duracion: this.tab() === 'agendar' ? this.duracionSintomas : (this.triageReq.duracion || this.duracionSintomas),
      antecedentes: this.tab() === 'agendar' ? this.antecedentesSintomas : (this.triageReq.antecedentes || this.antecedentesSintomas),
      edadPaciente: this.triageReq.edadPaciente,
      imagenBase64: this.dermReq.imagenBase64
    };
  }

  private dermatologyPayload(): AiDermatologyRequest {
    const sintomas = this.sintomas.trim();
    return {
      ...this.dermReq,
      descripcion: this.dermReq.descripcion?.trim() || sintomas,
      sintomasAsociados: this.dermReq.sintomasAsociados?.trim() || sintomas,
      tiempoEvolucion: this.dermReq.tiempoEvolucion || this.duracionSintomas
    };
  }

  changeTriage() {
    this.triageRsp.set(null);
    this.dermRsp.set(null);
  }

  runInteractions() {
    const meds = this.commaList(this.interMed);
    if (meds.length === 0) {
      this.error.set('Ingresa al menos 1 medicamento separado por comas.');
      return;
    }
    const req: AiInteractionRequest = {
      medicamentos: meds,
      dietaHabitual: this.commaList(this.interDieta),
      suplementos: this.commaList(this.interSuplem)
    };
    this.interLoading.set(true);
    this.error.set('');
    this.interRsp.set(null);
    this.ai.interactions(req).subscribe({
      next: (r) => { this.interRsp.set(r); this.interLoading.set(false); }
    });
  }

  estimatePrices() {
    if (!this.preciosReq.medicamento.trim()) {
      this.error.set('Ingresa el nombre del medicamento a comparar.');
      return;
    }
    const precio = this.preciosPrecioTxt ? parseFloat(this.preciosPrecioTxt) : undefined;
    const req: AiPricesRequest = {
      ...this.preciosReq,
      precioReportado: !isNaN(precio as number) ? precio : undefined
    };
    this.preciosLoading.set(true);
    this.error.set('');
    this.preciosRsp.set(null);
    this.ai.estimatePrices(req).subscribe({
      next: (r) => { this.preciosRsp.set(r); this.preciosLoading.set(false); }
    });
  }

  private commaList(s: string): string[] {
    if (!s) return [];
    return s.split(/[,;]/).map(x => x.trim()).filter(Boolean);
  }

  severityColor(sev: string): string {
    const s = (sev || '').toLowerCase();
    if (s.includes('rojo') || s.includes('critico') || s.includes('critica') || s.includes('severo')) return 'bg-red';
    if (s.includes('naranja') || s.includes('alto')) return 'bg-orange';
    if (s.includes('amarillo') || s.includes('medio')) return 'bg-yellow';
    if (s.includes('verde') || s.includes('bajo')) return 'bg-green';
    return 'bg-blue';
  }

  badgeClass(estado: string): string {
    return 'badge badge-' + estado.toLowerCase();
  }

  firstName(): string {
    const nombre = this.auth.user()?.nombre || this.profile()?.nombre || 'paciente';
    return nombre.trim().split(/\s+/)[0];
  }

  initials(nombre?: string): string {
    const parts = (nombre || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'P';
    return parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');
  }

  statusLabel(c: Appointment) {
    if (this.visitClosed(c) && (c.estado || '').toUpperCase() !== 'COMPLETADA') {
      return this.wasBroughtForward(c) ? 'Aceptada · se adelantó' : 'Aceptada · concluida';
    }
    return etiquetaCita(c);
  }

  visitClosed(c: Appointment) {
    if ((c.estado || '').toUpperCase() === 'COMPLETADA') return true;
    return this.avisosInbox().some(a => a.citaId === c.id && (a.tipo === 'INDICACION' || a.tipo === 'CONSULTA_CONCLUIDA' || /consulta concluida|indicaciones de tu consulta/i.test(a.titulo)));
  }

  wasBroughtForward(c: Appointment) {
    const fecha = new Date(c.fechaHora).getTime();
    const hecha = c.concluidaEn ? new Date(c.concluidaEn).getTime() : 0;
    return !!c.adelantada || (hecha > 0 && fecha > hecha) || (this.visitClosed(c) && fecha > Date.now());
  }

  finishedVisit(): Appointment | null {
    const todas = new Map<number, Appointment>();
    [...this.citas(), ...this.proximas()].forEach(c => todas.set(c.id, c));
    return [...todas.values()]
      .filter(c => this.visitClosed(c))
      .sort((a, b) => new Date(b.fechaHora).getTime() - new Date(a.fechaHora).getTime())[0] ?? null;
  }

  nextVisit(): Appointment | null {
    const ahora = Date.now();
    return this.proximas()
      .filter(c => !this.visitClosed(c))
      .filter(c => !['CANCELADA', 'RECHAZADA', 'COMPLETADA'].includes((c.estado || '').toUpperCase()))
      .filter(c => {
        const t = new Date(c.fechaHora).getTime();
        return !Number.isNaN(t) && t >= ahora;
      })
      .slice()
      .sort((a, b) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime())[0] ?? null;
  }

  private loadPrescription() {
    this.avisos.list().subscribe({
      next: n => {
        this.avisosInbox.set(n);
        this.applyPrescription();
      },
      error: () => this.applyPrescription()
    });
    this.svc.history().subscribe({
      next: c => {
        this.citas.set(c);
        this.applyPrescription();
      }
    });
  }

  private applyPrescription() {
    const aviso = this.visitNotice();
    const mensaje = aviso?.mensaje || '';
    const medsTexto = this.extractBlock(mensaje, 'Medicamentos:') || this.finishedVisit()?.receta || '';
    const nombres = this.namesFrom(medsTexto);
    const cuidados = this.extractBlock(mensaje, 'Qué hacer:');
    if (nombres.length) {
      this.recetaVisible.set(nombres.join(', '));
      if (!this.interMed.trim()) this.interMed = nombres.join(', ');
      if (!this.preciosReq.medicamento.trim()) {
        const presentacion = medsTexto.split('·')[1]?.split(/[;\n]/)[0]?.trim() || '';
        this.preciosReq = { ...this.preciosReq, medicamento: nombres[0], presentacion };
      }
    }
    if (cuidados && !this.interDieta.trim()) this.interDieta = cuidados;
    if (!this.interSuplem.trim() && (nombres.length || cuidados)) {
      this.interSuplem = this.supplementsFrom(`${medsTexto} ${cuidados}`);
    }
  }

  private visitNotice(): Notification | undefined {
    return this.avisosInbox()
      .filter(a => a.tipo === 'CONSULTA_CONCLUIDA' || a.tipo === 'INDICACION' || /consulta concluida|indicaciones de tu consulta/i.test(a.titulo || ''))
      .sort((a, b) => new Date(b.creadaEn).getTime() - new Date(a.creadaEn).getTime())[0];
  }

  private namesFrom(texto: string): string[] {
    if (!texto.trim()) return [];
    return texto.split(/[;\n]/)
      .map(p => p.split('·')[0].replace(/^[\-\d\.\)\s]+/, '').trim())
      .filter(p => p.length > 1);
  }

  private extractBlock(mensaje: string, marca: string) {
    const inicio = mensaje.toLowerCase().indexOf(marca.toLowerCase());
    if (inicio < 0) return '';
    let resto = mensaje.slice(inicio + marca.length).trim();
    const corte = resto.search(/\n\n|\n(?=Qué |Medicamentos:|Si algo empeora|—)/i);
    if (corte >= 0) resto = resto.slice(0, corte);
    return resto.trim();
  }

  private supplementsFrom(texto: string) {
    const hallados = texto.match(/vitamina [^,.;\n]+|omega[^,.;\n]*|magnesio|calcio|hierro|zinc|suplemento[^,.;\n]*/gi) || [];
    const unicos = [...new Set(hallados.map(s => s.trim()))];
    return unicos.length ? unicos.join(', ') : 'Ninguno indicado en la consulta';
  }

  visibleUpcoming(): Appointment[] {
    return this.proximas().filter(c => !this.visitClosed(c));
  }

  goTo(tab: PacienteTab, sub: PacienteSub = '') {
    this.onNavigate({ id: tab, label: '', tab, sub });
  }

  formatVisitDate(iso: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso || '');
    const fecha = match
      ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]))
      : new Date(iso);
    if (Number.isNaN(fecha.getTime())) return iso;
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const hora = fecha.getHours();
    const minutos = fecha.getMinutes().toString().padStart(2, '0');
    const sufijo = hora >= 12 ? 'p.m.' : 'a.m.';
    const hora12 = ((hora + 11) % 12) + 1;
    return `${fecha.getDate()} de ${meses[fecha.getMonth()]} de ${fecha.getFullYear()} · ${hora12}:${minutos} ${sufijo}`;
  }

  patientNotices(): { titulo: string; detalle: string }[] {
    const items: { titulo: string; detalle: string }[] = [...this.avisosReales()];
    const proxima = this.nextVisit();
    const dash = this.dashboard();
    const profile = this.profile();
    if (proxima) {
      items.push({
        titulo: `Próxima cita con ${proxima.medicoNombre}`,
        detalle: `${this.formatVisitDate(proxima.fechaHora)} · ${proxima.medicoEspecialidad || 'Consulta'}`
      });
    }
    if (dash?.citasPendientes) {
      items.push({
        titulo: `${dash.citasPendientes} cita(s) pendiente(s)`,
        detalle: 'El médico aún no confirma la solicitud.'
      });
    }
    if (profile?.alergias) {
      items.push({
        titulo: 'Alergias registradas',
        detalle: profile.alergias
      });
    }
    if (!items.length) {
      items.push({
        titulo: 'Sin novedades clínicas',
        detalle: 'Cuando tengas citas o datos en tu perfil, aparecerán aquí.'
      });
    }
    return items.slice(0, 3);

/** Patient portal: booking, history, pharmacy, and home. */
  }
}
