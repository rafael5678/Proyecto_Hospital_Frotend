import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { AdminService } from '../../services/admin.service';
import { User, UserRequest } from '../../models/user.model';
import { Appointment, etiquetaCita, formatColombia, formatAppointmentWhen } from '../../models/appointment.model';
import { Report } from '../../models/report.model';
import { PortalSidebarComponent, SidebarItem } from '../portal-sidebar/portal-sidebar.component';
import { SessionTimeoutComponent } from '../session-timeout/session-timeout.component';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';
import { AiService } from '../../services/ai.service';
import { AiAdminOperationResponse, AiPricesRequest, AiPricesResponse } from '../../models/ai.model';
import { AiMetrics } from '../../models/ai.model';
import { HOSPITAL_SPECIALTIES } from '../../data/specialties';
import {
  ID_MAX, PASSWORD_MAX, PASSWORD_MIN, BIRTH_DATE_MIN, BIRTH_DATE_MAX, GENDERS, BLOOD_TYPES,
  phoneMessage, birthDateMessage, normalizeGender, normalizeBloodType, idDigitsOnly, digitsOnly, isColombianPhone, isAllowedBirthDate, withoutSpaces, blockSpace
} from '../../data/person-data';

/** Administrator portal screens and Registro Hospy. */
type AdminTab = 'inicio' | 'usuarios' | 'medicos' | 'citas' | 'reportes' | 'iasuperv' | 'preciosauditoria' | 'asistente';
type AdminSub = '' | 'lista' | 'crear' | 'editar' | 'claves' | 'supervision' | 'resumen' | 'mensual';

@Component({
  selector: 'app-admin-portal',
  standalone: true,
  imports: [FormsModule, DecimalPipe, PortalSidebarComponent, SessionTimeoutComponent, NotificationBellComponent],
  templateUrl: './admin-portal.component.html',
  styleUrl: './admin-portal.component.css'
})
export class AdminPortalComponent implements OnInit {
  auth = inject(AuthService);
  private adminService = inject(AdminService);
  private ai = inject(AiService);
  readonly formatColombia = formatColombia;
  readonly formatAppointmentWhen = formatAppointmentWhen;

  tab = signal<AdminTab>('inicio');
  sub = signal<AdminSub>('');
  mesSobre = signal<number | null>(null);
  mesFijo = signal<number | null>(null);
  donutSobre = signal<string | null>(null);
  donutFijo = signal<string | null>(null);
  estadoSobre = signal<string | null>(null);
  mesBarraSobre = signal<string | null>(null);
  expandedMenus = signal<string[]>(['medicos', 'citas', 'reportes', 'ia']);
  readonly diasSemana = [
    { id: '1', nombre: 'Lun' }, { id: '2', nombre: 'Mar' }, { id: '3', nombre: 'Mié' },
    { id: '4', nombre: 'Jue' }, { id: '5', nombre: 'Vie' }, { id: '6', nombre: 'Sáb' }, { id: '7', nombre: 'Dom' }
  ];

  readonly menuItems: SidebarItem[] = [
    { id: 'inicio', label: 'Inicio', icon: '🏠', tab: 'inicio' },
    { id: 'usuarios', label: 'Usuarios', icon: '👥', tab: 'usuarios', sub: 'lista' },
    {
      id: 'medicos',
      label: 'Médicos',
      icon: '🩺',
      children: [
        { id: 'm-lista', label: 'Listar médicos', tab: 'medicos', sub: 'lista' }
      ]
    },
    {
      id: 'citas',
      label: 'Citas',
      icon: '📅',
      children: [
        { id: 'c-super', label: 'Supervisión de citas', tab: 'citas', sub: 'supervision' }
      ]
    },
    {
      id: 'reportes',
      label: 'Reportes',
      icon: '📊',
      children: [
        { id: 'r-resumen', label: 'Resumen general', tab: 'reportes', sub: 'resumen' },
        { id: 'r-mensual', label: 'Desglose mensual', tab: 'reportes', sub: 'mensual' }
      ]
    },
    {
      id: 'ia',
      label: 'Asistente',
      icon: '🤖',
      children: [
        { id: 'ia-asist', label: 'Registro Hospy', tab: 'asistente' },
        { id: 'ia-superv', label: 'Supervisión', tab: 'iasuperv' },
        { id: 'ia-precios', label: 'Auditoría precios', tab: 'preciosauditoria' }
      ]
    }
  ];

  usuarios = signal<User[]>([]);
  medicos = signal<User[]>([]);
  citas = signal<Appointment[]>([]);
  buscarCita = '';
  busquedaPersona = '';
  estadoCita = '';
  citaAReprogramar = signal<Appointment | null>(null);
  nuevaFechaHora = '';
  motivoReprogramacion = '';
  mensajeCambio = signal('');
  guardandoCambio = signal(false);
  reporte = signal<Report | null>(null);

  form: UserRequest = {
    nombre: '', email: '', password: '', rol: 'PACIENTE',
    telefono: '', documento: '', especialidad: '',
    fechaNacimiento: '', genero: '', ciudad: '', alergias: '',
    numeroLicencia: '', consultorio: '', anosExperiencia: undefined, biografia: ''
  };
  error = signal('');
  okAdmin = signal('');
  editandoId = signal<number | null>(null);
  claveVisible = '';
  especialidades: string[] = [...HOSPITAL_SPECIALTIES];

  aiStatus = signal<{ apiKeyActiva: boolean; version: string } | null>(null);
  aiMetricas = signal<AiMetrics | null>(null);

  preciosReq: AiPricesRequest = {
    medicamento: '',
    presentacion: '',
    precioReportado: 0,
    ciudad: 'Bogotá'
  };
  preciosPrecioTxt = '';
  preciosRsp = signal<AiPricesResponse | null>(null);
  preciosLoading = signal(false);
  readonly generos = GENDERS;
  readonly birthDateMin = BIRTH_DATE_MIN;
  readonly birthDateMax = BIRTH_DATE_MAX;
  readonly tiposSangre = BLOOD_TYPES;
  readonly digitsOnly = digitsOnly;
  readonly idDigitsOnly = idDigitsOnly;
  readonly withoutSpaces = withoutSpaces;
  readonly blockSpace = blockSpace;
  asistenteTexto = '';
  asistenteLoading = signal(false);
  asistenteRsp = signal<AiAdminOperationResponse | null>(null);
  asistenteBorrador = '';
  private asistenteHistorial: string[] = [];
  private esperandoEspecialidad = false;
  asistenteChat = signal<{ rol: 'admin' | 'ia'; texto: string }[]>([]);
  asistenteResponderVoz = true;

  ngOnInit() {
    this.loadUsers();
    this.loadDoctors();
    this.loadAppointments();
    this.loadReports();
    this.loadAiStatus();
    this.loadAiMetrics();
    this.loadSpecialties();
    this.ai.warmupConsult().subscribe({ next: () => {}, error: () => {} });
  }

  loadSpecialties() {
    this.adminService.listSpecialties().subscribe({
      next: lista => {
        const nombres = lista.map(s => s.nombre).filter(Boolean);
        if (!nombres.length) return;
        this.especialidades = nombres;
        this.rememberSpecialty(this.form.especialidad);
      }
    });
  }

  private rememberSpecialty(nombre?: string) {
    const n = (nombre || '').trim();
    if (n && !this.especialidades.includes(n)) this.especialidades = [...this.especialidades, n].sort((a, b) => a.localeCompare(b, 'es'));
  }

  loadAiStatus() {
    this.ai.status().subscribe({ next: s => this.aiStatus.set(s) });
  }

  loadAiMetrics() {
    this.adminService.aiMetrics().subscribe({ next: m => this.aiMetricas.set(m) });
  }

  onNavigate(item: SidebarItem) {
    if (!item.tab) return;
    this.tab.set(item.tab as AdminTab);
    this.sub.set((item.sub ?? '') as AdminSub);
    if (item.tab === 'reportes' || item.tab === 'inicio') this.loadReports();
    if (item.tab === 'inicio' || item.tab === 'citas' || item.tab === 'reportes') this.loadAppointments();
    if (item.tab === 'inicio' || item.tab === 'iasuperv') {
      this.loadAiMetrics();
      this.loadAiStatus();
    }
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
    const t = this.tab();
    const s = this.sub();
    const map: Record<string, string> = {
      inicio: 'Panel de inicio',
      'usuarios-lista': 'Usuarios — listado',
      'usuarios-crear': 'Pacientes — registrar',
      'usuarios-editar': 'Usuarios — editar',
      'usuarios-claves': 'Usuarios — accesos y claves',
      'medicos-lista': 'Médicos — listado',
      'medicos-crear': 'Médicos — registrar',
      'citas-supervision': 'Citas — supervisión',
      'reportes-resumen': 'Reportes — resumen',
      'reportes-mensual': 'Reportes — desglose mensual',
      iasuperv: 'Supervisión',
      preciosauditoria: 'Auditoría de precios',
      asistente: 'Registro Hospy'
    };
    return map[`${t}-${s}`] ?? map[t] ?? 'Administración';
  }

  loadUsers() {
    this.adminService.listUsers().subscribe({ next: u => this.usuarios.set(u) });
  }

  loadDoctors() {
    this.adminService.listDoctors().subscribe({ next: m => this.medicos.set(m) });
  }

  loadAppointments() {
    this.adminService.superviseAppointments().subscribe({ next: c => this.citas.set(c) });
  }

  filteredAppointments(): Appointment[] {
    const consulta = this.buscarCita.trim().toLocaleLowerCase();
    return this.citas().filter(c => {
      const coincideEstado = !this.estadoCita || c.estado === this.estadoCita;
      const texto = `${c.pacienteNombre} ${c.medicoNombre} ${c.medicoEspecialidad ?? ''} ${c.triageSeveridad ?? ''}`.toLocaleLowerCase();
      return coincideEstado && (!consulta || texto.includes(consulta));
    });
  }

  appointmentsWithTriage(): number {
    return this.citas().filter(c => c.triageSeveridad).length;
  }

  appointmentsWithSkinReview(): number {
    return this.citas().filter(c => c.dermatologiaScoreRiesgo != null).length;
  }

  urgentAppointments(): number {
    return this.citas().filter(c => (c.triagePrioridad ?? 0) >= 8 || ['ROJO', 'NARANJA'].includes((c.triageSeveridad ?? '').toUpperCase())).length;
  }

  openReschedule(cita: Appointment) {
    this.citaAReprogramar.set(cita);
    this.nuevaFechaHora = '';
    this.motivoReprogramacion = '';
    this.mensajeCambio.set('');
  }

  rescheduleAppointment() {
    const cita = this.citaAReprogramar();
    if (!cita || !this.nuevaFechaHora || !this.motivoReprogramacion.trim()) {
      this.error.set('Indica la nueva fecha y el motivo del cambio.');
      return;
    }
    this.error.set('');
    this.guardandoCambio.set(true);
    this.adminService.rescheduleAppointment(cita.id, `${this.nuevaFechaHora}:00`, this.motivoReprogramacion.trim()).subscribe({
      next: result => {
        this.guardandoCambio.set(false);
        this.mensajeCambio.set(result.mensaje);
        this.citaAReprogramar.set(null);
        this.loadAppointments();
      },
      error: e => {
        this.guardandoCambio.set(false);
        this.error.set(e.error?.error ?? 'No se pudo reprogramar la cita.');
      }
    });
  }

  loadReports() {
    this.adminService.reports().subscribe({ next: r => this.reporte.set(r) });
  }

  deactivate(id: number) {
    this.changeActive(id, false);
  }

  changeActive(id: number, activo: boolean) {
    this.adminService.setActive(id, activo).subscribe({
      next: () => { this.loadUsers(); this.loadDoctors(); this.okAdmin.set(activo ? 'Cuenta activada' : 'Cuenta desactivada'); },
      error: (e) => this.error.set(e.error?.error ?? 'No se pudo cambiar el estado')
    });
  }

  editUser(u: User) {
    this.editandoId.set(this.userId(u));
    this.claveVisible = u.clave || '';
    this.form = {
      nombre: u.nombre, email: u.email, password: '', rol: u.rol,
      telefono: digitsOnly(u.telefono || ''), documento: this.visibleDocument(u.documento || ''),
      fechaNacimiento: u.fechaNacimiento || '', genero: normalizeGender(u.genero || ''),
      tipoSangre: normalizeBloodType(u.tipoSangre || ''), direccion: u.direccion || '', ciudad: u.ciudad || '',
      alergias: u.alergias || '', contactoEmergencia: u.contactoEmergencia || '',
      telefonoEmergencia: digitsOnly(u.telefonoEmergencia || ''), observaciones: u.observaciones || '',
      especialidad: u.especialidad || '', numeroLicencia: u.numeroLicencia || '',
      consultorio: u.consultorio || '', anosExperiencia: u.anosExperiencia, biografia: u.biografia || '',
      diasAtencion: u.diasAtencion || '', horaInicio: u.horaInicio || '', horaFin: u.horaFin || '',
      horaInicio2: u.horaInicio2 || '', horaFin2: u.horaFin2 || ''
    };
    this.rememberSpecialty(u.especialidad);
    this.tab.set('usuarios');
    this.sub.set('editar');
    this.error.set('');
  }

  dayChecked(id: string) {
    return (this.form.diasAtencion || '').split(',').map(s => s.trim()).includes(id);
  }

  toggleDay(id: string) {
    const set = new Set((this.form.diasAtencion || '').split(',').map(s => s.trim()).filter(Boolean));
    if (set.has(id)) set.delete(id);
    else set.add(id);
    this.form.diasAtencion = [...set].sort().join(',');
  }

  phoneValid(valor?: string) {
    return isColombianPhone(valor || '');
  }

  visibleDocument(valor: string) {
    const texto = (valor || '').trim();
    return /^\d+$/.test(texto) ? texto.slice(0, ID_MAX) : texto;
  }

  onIdTyped(valor: string) {
    const texto = valor ?? '';
    if (/[A-Za-z]/.test(texto) && !/\d/.test(texto)) return texto.slice(0, 20);
    return idDigitsOnly(texto);
  }

  idTooLong() {
    return (this.form.documento || '').replace(/\D/g, '').length > ID_MAX;
  }

  private completePhone(valor?: string) {
    const d = digitsOnly(valor || '');
    return !!d && isColombianPhone(d);
  }

  unlockPassword(event: Event) {
    const campo = event.target as HTMLInputElement | null;
    campo?.removeAttribute('readonly');
  }

  passwordTooShort() {
    const n = (this.form.password || '').length;
    return n > 0 && n < PASSWORD_MIN;
  }

  passwordText() {
    const n = (this.form.password || '').length;
    if (!n) return `Mínimo ${PASSWORD_MIN} caracteres. Vacía = no cambiar la clave.`;
    if (n < PASSWORD_MIN) return `${n} de ${PASSWORD_MIN} caracteres como mínimo.`;
    return `${n} caracteres. Máximo ${PASSWORD_MAX}.`;
  }

  saveEdit() {
    const id = this.editandoId();
    if (!id) return;
    const clave = this.form.password?.trim() || '';
    this.form.telefono = digitsOnly(this.form.telefono || '');
    this.form.telefonoEmergencia = digitsOnly(this.form.telefonoEmergencia || '');
    if (clave && (clave.length < PASSWORD_MIN || clave.length > PASSWORD_MAX)) {
      this.error.set(`La nueva clave debe tener entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres.`);
      return;
    }
    if (!isColombianPhone(this.form.telefono)) {
      this.error.set(phoneMessage('El teléfono'));
      return;
    }
    if (this.form.rol === 'PACIENTE' && !isColombianPhone(this.form.telefonoEmergencia || '')) {
      this.error.set(phoneMessage('El teléfono de emergencia'));
      return;
    }
    if (this.form.rol === 'PACIENTE' && !isAllowedBirthDate(this.form.fechaNacimiento || '')) {
      this.error.set(birthDateMessage());
      return;
    }
    if (this.form.rol === 'PACIENTE') {
      const doc = (this.form.documento || '').trim();
      if (doc && /^\d+$/.test(doc) && doc.length > ID_MAX) {
        this.error.set(`La cédula tiene máximo ${ID_MAX} dígitos.`);
        return;
      }
      if (doc && !/^\d+$/.test(doc)) {
        const digitos = idDigitsOnly(doc);
        if (digitos.length >= 6) this.form.documento = digitos;
        else if (/\d/.test(doc)) {
          this.error.set(`La cédula solo lleva números, máximo ${ID_MAX}.`);
          return;
        }
      }
    }
    const datos: UserRequest = { ...this.form, password: clave || undefined };
    this.adminService.updateUser(id, datos).subscribe({
      next: (guardado) => {
        this.okAdmin.set('Datos actualizados. Es la misma ficha: el correo y la clave de esa persona, no una cuenta nueva.');
        this.claveVisible = guardado.clave || clave || this.claveVisible;
        this.usuarios.update(lista => lista.map(u => this.userId(u) === id ? { ...u, ...guardado, clave: guardado.clave || clave || u.clave } : u));
        this.resetForm();
        this.editandoId.set(null);
        this.loadUsers();
        this.loadDoctors();
        this.sub.set('lista');
      },
      error: (e) => this.error.set(e.error?.error ?? 'No se pudo actualizar')
    });
  }

  visibleText(texto?: string) {
    return (texto || '')
      .replace(/Gemini\/LLM/gi, 'el asistente')
      .replace(/Gemini visión \+ clasificador local/gi, 'revisión de imagen')
      .replace(/análisis Gemini\/NLP/gi, 'análisis de síntomas')
      .replace(/Gemini revisa interacciones/gi, 'revisión de medicamentos')
      .replace(/estimación Gemini/gi, 'estimación de precios')
      .replace(/Gemini Audio/gi, 'voz')
      .replace(/Claude Haiku/gi, 'el asistente')
      .replace(/Whisper/gi, 'voz')
      .replace(/gemini[\w.\-]*/gi, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\(\s*\)/g, '')
      .trim();
  }

  searchResults(): User[] {
    const frase = this.busquedaPersona.trim().toLowerCase();
    if (frase.length < 2) return [];
    const digitos = frase.replace(/\D/g, '');
    const empieza = /comienza|empieza|inicia|empiec/.test(frase);
    const pidePaciente = /paciente/.test(frase);
    const pideMedico = /médico|medico/.test(frase);
    const nombre = frase
      .replace(/estoy|buscando|buscar|busco|quiero|encontrar|por favor|un paciente|una paciente|el paciente|la paciente|un médico|un medico|el médico|el medico|un usuario|usuario|con la cédula|con la cedula|cédula|cedula|documento|que comienza con|que empieza con|comienza con|empieza con|número|numero/gi, ' ')
      .replace(/\d+/g, ' ')
      .replace(/[^a-záéíóúñü\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return this.usuarios().filter(u => u.rol !== 'ADMIN').filter(u => {
      if (pidePaciente && !pideMedico && u.rol !== 'PACIENTE') return false;
      if (pideMedico && !pidePaciente && u.rol !== 'MEDICO') return false;
      const doc = (u.documento || '').replace(/\D/g, '');
      const docOk = digitos.length >= 3 && (empieza ? doc.startsWith(digitos) : doc.includes(digitos));
      const nomOk = nombre.length >= 2 && (u.nombre || '').toLowerCase().includes(nombre);
      if (digitos.length >= 3 && nombre.length >= 2) return docOk || nomOk;
      if (digitos.length >= 3) return docOk;
      return nomOk;
    }).slice(0, 8);
  }

  userId(u: User): number {
    return u.usuarioId ?? u.id;
  }

  askAssistant() {
    const texto = this.asistenteTexto.trim();
    if (!texto) {
      this.error.set('Escribe el médico, el paciente o la especialización que quieres crear.');
      return;
    }
    this.error.set('');
    this.okAdmin.set('');
    this.asistenteChat.update(c => [...c, { rol: 'admin', texto }]);
    this.asistenteTexto = '';
    if (this.esperandoEspecialidad && (this.looksLikePersonForm(texto) || this.isPersonCreateAsk(texto))) {
      this.esperandoEspecialidad = false;
    }
    if (this.esperandoEspecialidad) {
      const nombre = this.extractSpecialtyName(texto);
      if (!nombre) {
        this.askSpecialtyName();
        return;
      }
      this.saveSpecialtyFromChat(nombre);
      return;
    }
    if (this.isSpecialtyAsk(texto)) {
      const nombre = this.extractSpecialtyName(texto);
      if (nombre) {
        this.saveSpecialtyFromChat(nombre);
        return;
      }
      this.askSpecialtyName();
      return;
    }
    this.asistenteLoading.set(true);
    const historial = this.asistenteBorrador ? [...this.asistenteHistorial] : [];
    this.ai.runAdminOperation({ instruccion: texto, borrador: this.asistenteBorrador || undefined, historial }).subscribe({
      next: r => {
        this.asistenteRsp.set(r);
        const sigue = !(r.accion === 'INFO' && !r.nombre);
        this.asistenteBorrador = sigue ? JSON.stringify(r) : '';
        this.asistenteHistorial = sigue ? [...historial, texto] : [];
        if (r.accion === 'CREAR_MEDICO' || r.accion === 'CREAR_PACIENTE') {
          const falta = this.questionIfMissing(r);
          if (falta) {
            this.asistenteLoading.set(false);
            this.replyToAssistant(falta);
            return;
          }
          this.createFromAssistant(r);
          return;
        }
        this.asistenteLoading.set(false);
        if ((r.especialidad?.trim() && this.isJunkSpecialtyName(r.especialidad))
            || this.isJunkSpecialtyReply(r.mensaje)) {
          this.askSpecialtyName();
          return;
        }
        if (r.especialidad) this.rememberSpecialty(r.especialidad);
        this.loadSpecialties();
        this.replyToAssistant(r.mensaje);
      },
      error: e => {
        this.asistenteLoading.set(false);
        this.error.set(e.error?.error ?? 'No se pudo interpretar la instrucción.');
      }
    });
  }

  private isPersonCreateAsk(texto: string): boolean {
    const t = this.withoutAccent(texto);
    const persona = t.includes('paciente') || t.includes('medico') || t.includes('doctor');
    const crea = t.includes('crea') || t.includes('registr') || t.includes('quiero') || t.includes('agreg');
    return persona && crea;
  }

  private looksLikePersonForm(texto: string): boolean {
    const t = this.withoutAccent(texto);
    const pistas = ['correo', 'contrasena', '@', 'licencia', 'telefono', 'horario', 'nombre completo', 'documento', 'experiencia'];
    return pistas.filter(p => t.includes(p)).length >= 2;
  }

  private isSpecialtyAsk(texto: string): boolean {
    const t = this.withoutAccent(texto);
    const pide = t.includes('especializ') || t.includes('especialidad');
    if (!pide) return false;
    if (this.looksLikePersonForm(texto) || this.isPersonCreateAsk(texto)) return false;
    return t.includes('crea') || t.includes('quiero') || t.includes('agreg') || t.includes('nueva')
      || t.includes('registr') || t.includes('anade') || t.includes('ponme') || t.includes('como se llama');
  }

  private extractSpecialtyName(texto: string): string {
    if (this.isJunkSpecialtyName(texto)) return '';
    const match = texto.match(/(?:especializaci[oó]n|especialidad)\s*[:\-–]?\s*(?:se\s+llama\s+|llamada\s+|es\s+|de\s+)?([\p{L}][\p{L} .'-]{2,80})/iu);
    let hallado = match?.[1]?.replace(/\s+(para|del|de)\s+(los\s+|las\s+)?m[eé]dicos.*$/i, '').trim() || '';
    if (hallado && !this.isJunkSpecialtyName(hallado)) return hallado;
    const limpio = texto.trim()
      .replace(/^(este es el nombre de (la |el )?)?(la )?(especializaci[oó]n|especialidad)\s*[:\-–]?\s*/i, '')
      .replace(/^(se llama|llamada|es)\s+/i, '')
      .replace(/[.。]+$/, '')
      .trim();
    if (this.isJunkSpecialtyName(limpio)) return '';
    if (!/^[\p{L}][\p{L} .'-]{2,80}$/u.test(limpio)) return '';
    const plano = this.withoutAccent(limpio);
    if (plano.includes('especializ') || plano.includes('especialidad')) return '';
    return limpio;
  }

  private isJunkSpecialtyName(texto: string | null | undefined): boolean {
    const t = this.withoutAccent(texto || '').replace(/\s+/g, ' ').trim();
    if (!t) return true;
    if (/\b(quiero|necesito|deseo|vamos a|voy a)\b/.test(t)) return true;
    if (/\b(crear|crea|agregar|agrega|registr|anade|ponme)\b/.test(t) && /especializ|especialidad/.test(t)) return true;
    if (/una especializ|una especialidad|la especializ|la especialidad/.test(t)) return true;
    return /^(una |la )?(nueva )?(especializacion|especialidad)$/.test(t);
  }

  private isJunkSpecialtyReply(texto: string | null | undefined): boolean {
    const t = this.withoutAccent(texto || '');
    return /quiero .{0,80}especializ/.test(t) || /quiero .{0,80}especialidad/.test(t);
  }

  private askSpecialtyName() {
    this.esperandoEspecialidad = true;
    this.replyToAssistant('¿Cómo se llama la especialización? Escribe solo el nombre, por ejemplo Dermatología.');
  }

  private withoutAccent(texto: string): string {
    return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  }

  private saveSpecialtyFromChat(nombre: string) {
    if (this.isJunkSpecialtyName(nombre)) {
      this.askSpecialtyName();
      return;
    }
    this.asistenteLoading.set(true);
    this.adminService.createSpecialty(nombre).subscribe({
      next: r => {
        this.asistenteLoading.set(false);
        if (this.isJunkSpecialtyName(r.nombre)) {
          this.askSpecialtyName();
          return;
        }
        this.esperandoEspecialidad = false;
        this.rememberSpecialty(r.nombre);
        this.loadSpecialties();
        this.replyToAssistant(r.yaExistia
          ? `${r.nombre} ya estaba creada. Ya aparece al registrar o editar un médico.`
          : `Listo, creé la especialización ${r.nombre}. Ya aparece al registrar o editar un médico.`);
      },
      error: e => {
        this.asistenteLoading.set(false);
        this.esperandoEspecialidad = true;
        this.replyToAssistant(e.error?.error ?? 'No se pudo crear. Publica el backend en Render y vuelve a intentarlo. ¿Cómo se llama la especialización?');
      }
    });
  }

  private questionIfMissing(r: AiAdminOperationResponse): string | null {
    const medico = r.accion === 'CREAR_MEDICO';
    const faltan: string[] = [];
    if (!r.nombre?.trim()) faltan.push('el nombre completo');
    if (!r.email?.includes('@')) faltan.push('el correo');
    if (!r.passwordSugerida || r.passwordSugerida.length < PASSWORD_MIN || r.passwordSugerida.length > PASSWORD_MAX) {
      faltan.push(`la contraseña (entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres)`);
    }
    if (medico) {
      if (!r.especialidad?.trim()) faltan.push('la especialidad');
      if (r.anosExperiencia == null) faltan.push('los años de experiencia');
      if (!r.numeroLicencia?.trim()) faltan.push('el número de licencia');
      if (!this.completePhone(r.telefono)) faltan.push('un teléfono de 10 dígitos (celular empieza por 3, fijo por 60)');
      if (!r.diasAtencion || !r.horaInicio || !r.horaFin) faltan.push('el horario de atención, con los días y las horas');
    } else {
      if (!r.documento?.trim()) faltan.push('el documento de identidad');
      if (!this.completePhone(r.telefono)) faltan.push('un teléfono de 10 dígitos (celular empieza por 3, fijo por 60)');
      if (!r.fechaNacimiento || !/^\d{4}-\d{2}-\d{2}$/.test(r.fechaNacimiento) || !isAllowedBirthDate(r.fechaNacimiento)) {
        faltan.push('la fecha de nacimiento (hasta 2021, no un día futuro)');
      }
      if (!normalizeGender(r.genero || '')) faltan.push('el género (masculino, femenino u otro)');
      if (!normalizeBloodType(r.tipoSangre || '')) faltan.push('el tipo de sangre (O+, O-, A+, A-, B+, B-, AB+ o AB-)');
      if (!r.direccion?.trim()) faltan.push('la dirección');
      if (!r.ciudad?.trim()) faltan.push('la ciudad');
      if (!r.alergias?.trim()) faltan.push('las alergias (o «ninguna»)');
      if (!r.contactoEmergencia?.trim()) faltan.push('el contacto de emergencia');
      if (!this.completePhone(r.telefonoEmergencia)) faltan.push('un teléfono de emergencia de 10 dígitos');
    }
    if (!faltan.length) return null;
    const quien = r.nombre?.trim();
    const lista = faltan.length === 1 ? faltan[0] : `${faltan.slice(0, -1).join(', ')} y ${faltan[faltan.length - 1]}`;
    return quien
      ? `${quien} ya quedó anotado. Para registrarlo me falta ${lista}. Puedes escribirlos como quieras.`
      : `Para registrarlo me falta ${lista}. Puedes escribirlos como quieras.`;
  }

  private createFromAssistant(r: AiAdminOperationResponse) {
    const clave = r.passwordSugerida || '';
    const comun = {
      nombre: r.nombre || '',
      email: r.email || '',
      password: clave,
      telefono: digitsOnly(r.telefono || ''),
      ciudad: r.ciudad || '',
      genero: normalizeGender(r.genero || ''),
      alergias: r.alergias || '',
      fechaNacimiento: r.fechaNacimiento || ''
    };
    const alta = r.accion === 'CREAR_MEDICO'
      ? this.adminService.createDoctor({
          ...comun,
          rol: 'MEDICO',
          especialidad: r.especialidad || '',
          numeroLicencia: r.numeroLicencia || '',
          consultorio: r.consultorio || '',
          anosExperiencia: r.anosExperiencia,
          biografia: r.biografia || '',
          diasAtencion: r.diasAtencion || '',
          horaInicio: r.horaInicio || '',
          horaFin: r.horaFin || '',
          horaInicio2: r.horaInicio2 || '',
          horaFin2: r.horaFin2 || ''
        })
      : this.adminService.createUser({
          ...comun,
          rol: 'PACIENTE',
          documento: r.documento || '',
          tipoSangre: normalizeBloodType(r.tipoSangre || ''),
          direccion: r.direccion || '',
          contactoEmergencia: r.contactoEmergencia || '',
          telefonoEmergencia: digitsOnly(r.telefonoEmergencia || ''),
          observaciones: r.observaciones || ''
        });
    alta.subscribe({
      next: () => {
        this.asistenteLoading.set(false);
        const tipo = r.accion === 'CREAR_MEDICO' ? 'Médico' : 'Paciente';
        const detalle = r.accion === 'CREAR_MEDICO'
          ? `Especialidad ${r.especialidad}. Horario ${r.horario || 'el que indicaste'}.`
          : `Documento ${r.documento}.`;
        this.asistenteChat.update(c => [...c, {
          rol: 'ia',
          texto: `${tipo} creado: ${r.nombre}. ${detalle} Para iniciar sesión: correo ${r.email} y contraseña ${clave}. Entrégaselos; la contraseña no se vuelve a mostrar.`
        }]);
        this.speakAssistant(`${tipo} ${r.nombre} registrado. Los datos de acceso están en pantalla.`);
        this.asistenteBorrador = '';
        this.asistenteHistorial = [];
        this.asistenteRsp.set(null);
        this.loadUsers();
        this.loadDoctors();
        this.loadReports();
        this.loadSpecialties();
      },
      error: e => {
        this.asistenteLoading.set(false);
        this.replyToAssistant(e.error?.error ?? 'No se pudo crear la cuenta. Corrige el dato y vuelve a enviarlo.');
      }
    });
  }

  private replyToAssistant(texto: string) {
    this.asistenteChat.update(c => [...c, { rol: 'ia', texto }]);
    this.speakAssistant(texto);
  }

  private speakAssistant(texto: string) {
    if (!this.asistenteResponderVoz || typeof speechSynthesis === 'undefined') return;
    speechSynthesis.cancel();
    const voz = new SpeechSynthesisUtterance(texto.slice(0, 600));
    voz.lang = 'es-CO';
    voz.rate = 1;
    const es = speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith('es'));
    if (es) voz.voice = es;
    speechSynthesis.speak(voz);
  }

  resetForm() {
    this.form = {
      nombre: '', email: '', password: '', rol: 'PACIENTE',
      telefono: '', documento: '', especialidad: '',
      fechaNacimiento: '', genero: '', ciudad: '', alergias: '',
      numeroLicencia: '', consultorio: '', anosExperiencia: undefined, biografia: ''
    };
    this.error.set('');
  }

  statusLabel(c: Appointment) {
    return etiquetaCita(c);
  }

  badgeClass(estado: string): string {
    return 'badge badge-' + estado.toLowerCase();
  }

  markupSeverityColor(eval_: string): string {
    switch ((eval_ || '').toUpperCase()) {
      case 'SOBREPRECIO_ALTO':
      case 'DESABASTECIMIENTO_ARTIFICIAL': return 'bg-red';
      case 'SOBREPRECIO_BAJO': return 'bg-orange';
      case 'DENTRO_RANGO': return 'bg-green';
      default: return 'bg-blue';
    }
  }

  markupSeverityLabel(eval_: string): string {
    switch ((eval_ || '').toUpperCase()) {
      case 'SOBREPRECIO_ALTO': return 'SOBREPRECIO ALTO';
      case 'DESABASTECIMIENTO_ARTIFICIAL': return 'DESABASTECIMIENTO ARTIFICIAL';
      case 'SOBREPRECIO_BAJO': return 'SOBREPRECIO BAJO';
      case 'DENTRO_RANGO': return 'DENTRO DE RANGO';
      default: return eval_ || '—';
    }
  }

  estimatePrices() {
    const precio = Number(this.preciosPrecioTxt);
    if (!this.preciosReq.medicamento.trim() || isNaN(precio) || precio <= 0) {
      this.error.set('Escriba el medicamento y un precio reportado positivo.');
      return;
    }
    this.error.set('');
    this.preciosReq.precioReportado = precio;
    this.preciosLoading.set(true);
    this.ai.estimatePrices(this.preciosReq).subscribe({
      next: r => this.preciosRsp.set(r),
      complete: () => this.preciosLoading.set(false)
    });
  }

  severityEntries(dist: { [key: string]: number }): { key: string; value: number }[] {
    if (!dist) return [];
    return Object.entries(dist).map(([key, value]) => ({ key, value }));
  }

  severityBarColor(sev: string): string {
    const s = sev.toLowerCase();
    if (s.includes('rojo')) return 'bar-red';
    if (s.includes('naranja')) return 'bar-orange';
    if (s.includes('amarillo')) return 'bar-yellow';
    if (s.includes('verde')) return 'bar-green';
    return 'bar-blue';
  }

  initials(nombre?: string): string {
    const parts = (nombre || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'A';
    return parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');
  }

  todayLabel(): string {
    return new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) + ' · Hoy';
  }

  appointmentsTodayCount(): number {
    const hoy = this.colombiaDate();
    return this.citas().filter(c => this.visitDate(c.fechaHora) === hoy).length;
  }

  todayPendingCount(): number {
    const hoy = this.colombiaDate();
    return this.citas().filter(c => this.visitDate(c.fechaHora) === hoy && (c.estado || '').toUpperCase() === 'PENDIENTE').length;
  }

  acceptedVisitCount(): number {
    return this.citas().filter(c => {
      const e = (c.estado || '').toUpperCase();
      return e === 'ACEPTADA' || e === 'COMPLETADA';
    }).length;
  }

  cancelledVisitCount(): number {
    return this.citas().filter(c => {
      const e = (c.estado || '').toUpperCase();
      return e === 'CANCELADA' || e === 'RECHAZADA';
    }).length;
  }

  pendingVisitCount(): number {
    return this.citas().filter(c => (c.estado || '').toUpperCase() === 'PENDIENTE').length;
  }

  /** Live report cards: cancelled includes rejected visits. */
  reportCancelledCount(): number {
    return this.citas().length ? this.cancelledVisitCount() : (this.reporte()?.citasCanceladas ?? 0);
  }

  reportAcceptedCount(): number {
    return this.citas().length ? this.acceptedVisitCount() : (this.reporte()?.citasAceptadas ?? 0);
  }

  reportPendingCount(): number {
    return this.citas().length ? this.pendingVisitCount() : (this.reporte()?.citasPendientes ?? 0);
  }

  reportTotalAppointments(): number {
    return this.citas().length ? this.citas().length : (this.reporte()?.totalCitas ?? 0);
  }

  private colombiaDate(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  }

  private visitDate(iso?: string): string {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(iso || '');
    return match ? match[1] : '';
  }

  monthlyPoints(): { label: string; nombre: string; x: number; y: number; total: number }[] {
    const meses = this.reporte()?.desgloseMensual ?? [];
    if (!meses.length) return [];
    const max = Math.max(...meses.map(m => m.totalCitas), 1);
    return meses.map((m, i) => ({
      label: (m.nombreMes || '').slice(0, 3),
      nombre: m.nombreMes || 'Mes',
      total: m.totalCitas,
      x: meses.length === 1 ? 180 : 20 + (i * (320 / (meses.length - 1))),
      y: 140 - (m.totalCitas / max) * 110
    }));
  }

  visibleMonth(): number | null {
    return this.mesSobre() ?? this.mesFijo();
  }

  selectMonth(indice: number) {
    this.mesFijo.set(this.mesFijo() === indice ? null : indice);
  }

  visibleDonut(): string | null {
    return this.donutSobre() ?? this.donutFijo();
  }

  selectDonut(statusLabel: string) {
    this.donutFijo.set(this.donutFijo() === statusLabel ? null : statusLabel);
  }

  monthlyLine(): string {
    return this.monthlyPoints().map(p => `${p.x},${p.y}`).join(' ');
  }

  monthBars(): { nombre: string; total: number; alto: number }[] {
    const meses = this.reporte()?.desgloseMensual ?? [];
    const max = Math.max(...meses.map(m => m.totalCitas), 1);
    return meses.map(m => ({
      nombre: (m.nombreMes || '').slice(0, 3),
      total: m.totalCitas,
      alto: Math.max(6, (m.totalCitas / max) * 120)
    }));
  }

  appointmentStatuses(): { label: string; total: number; color: string; ancho: number }[] {
    const items = [
      { label: 'Pendientes', total: this.reportPendingCount(), color: '#f59e0b' },
      { label: 'Aceptadas', total: this.reportAcceptedCount(), color: '#16a34a' },
      { label: 'Canceladas', total: this.reportCancelledCount(), color: '#94a3b8' }
    ];
    const max = Math.max(...items.map(i => i.total), 1);
    return items.map(i => ({ ...i, ancho: (i.total / max) * 100 }));
  }

  specialtyDonut(): { label: string; color: string; dash: number; gap: number; offset: number; porcentaje: number; total: number }[] {
    const colores = ['#3b82f6', '#22c55e', '#8b5cf6', '#f59e0b', '#06b6d4', '#ef4444'];
    const conteo = new Map<string, number>();
    for (const cita of this.citas()) {
      const key = cita.medicoEspecialidad || 'Sin especialidad';
      conteo.set(key, (conteo.get(key) ?? 0) + 1);
    }
    const items = [...conteo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const total = items.reduce((s, [, n]) => s + n, 0) || 1;
    const circ = 2 * Math.PI * 38;
    let acc = 0;
    return items.map(([label, n], i) => {
      const pct = n / total;
      const dash = pct * circ;
      const item = {
        label,
        color: colores[i % colores.length],
        dash,
        gap: circ - dash,
        offset: -(acc * circ),
        porcentaje: Math.round(pct * 100),
        total: n
      };
      acc += pct;
      return item;
    });
  }

  systemAlerts(): { titulo: string; detalle: string }[] {
    const items: { titulo: string; detalle: string }[] = [];
    const m = this.aiMetricas();
    if (this.urgentAppointments()) {
      items.push({
        titulo: `${this.urgentAppointments()} cita(s) de prioridad alta`,
        detalle: 'Requieren revisión en supervisión de citas.'
      });
    }
    if (this.reporte()?.citasPendientes) {
      items.push({
        titulo: `${this.reporte()?.citasPendientes} citas pendientes`,
        detalle: 'Aún no han sido aceptadas por el médico.'
      });
    }
    if (m && !m.apiKeyActiva) {
      items.push({
        titulo: 'Asistente en espera',
        detalle: 'Todavía no hay una clave configurada.'
      });
    }
    if (m?.citasConEvaluacionPiel) {
      items.push({
        titulo: `${m.citasConEvaluacionPiel} evaluaciones de piel`,
        detalle: 'Registradas en citas reales.'
      });
    }
    if (!items.length) {
      items.push({
        titulo: 'Sin alertas activas',
        detalle: 'El sistema no tiene pendientes críticos en este momento.'
      });
    }
    return items.slice(0, 4);
  }

  performanceItems(): { label: string; valor: string; detalle: string }[] {
    const m = this.aiMetricas();
    const total = this.citas().length;
    const aceptadas = this.acceptedVisitCount();
    const triage = this.citas().filter(c => c.triageSeveridad).length;
    return [
      { label: 'Citas aceptadas', valor: this.displayPct(aceptadas, total), detalle: `${aceptadas} de ${total}` },
      { label: 'Con triage', valor: this.displayPct(triage, total), detalle: `${triage} citas orientadas` },
      {
        label: 'Asistente de IA',
        valor: this.aiStatus()?.haikuUsd ? `~${this.aiStatus()?.haikuUsd} USD` : (m?.apiKeyActiva ? 'Activo' : 'En espera'),
        detalle: this.aiStatus()?.haikuLlamadas
          ? `${this.aiStatus()?.haikuLlamadas} respuestas esta sesión`
          : (m?.apiKeyActiva ? 'Asistente listo' : 'Sin conexión')
      }
    ];
  }

  /** Never show 100% or more: cancelled/rejected visits keep the board under a full score. */
  private displayPct(parte: number, total: number): string {
    if (!total) return '0%';
    const raw = (parte / total) * 100;
    if (raw <= 0) return '0%';
    if (raw >= 100) return '99%';
    return `${Math.round(raw)}%`;
  }

}
