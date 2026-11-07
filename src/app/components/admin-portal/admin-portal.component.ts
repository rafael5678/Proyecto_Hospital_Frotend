import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { AdminService } from '../../services/admin.service';
import { User, UserRequest } from '../../models/user.model';
import { Appointment, etiquetaCita } from '../../models/appointment.model';
import { Report } from '../../models/report.model';
import { PortalSidebarComponent, SidebarItem } from '../portal-sidebar/portal-sidebar.component';
import { SessionTimeoutComponent } from '../session-timeout/session-timeout.component';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';
import { AiService } from '../../services/ai.service';
import { AiAdminOperationResponse, AiPricesRequest, AiPricesResponse } from '../../models/ai.model';
import { AiMetrics } from '../../models/ai.model';
import { HOSPITAL_SPECIALTIES } from '../../data/specialties';
import {
  ID_MAX, PASSWORD_MAX, PASSWORD_MIN, GENDERS, BLOOD_TYPES,
  phoneMessage, normalizeGender, normalizeBloodType, idDigitsOnly, digitsOnly, isColombianPhone, withoutSpaces, blockSpace
} from '../../data/person-data';

type AdminTab = 'inicio' | 'usuarios' | 'medicos' | 'citas' | 'reportes' | 'iasuperv' | 'preciosauditoria' | 'asistente';
type AdminSub = '' | 'lista' | 'crear' | 'editar' | 'claves' | 'supervision' | 'resumen' | 'mensual';

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
  selector: 'app-admin-portal',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe, PortalSidebarComponent, SessionTimeoutComponent, NotificationBellComponent],
  templateUrl: './admin-portal.component.html',
  styleUrl: './admin-portal.component.css'
})
export class AdminPortalComponent implements OnInit {
  auth = inject(AuthService);
  private adminService = inject(AdminService);
  private ai = inject(AiService);

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
  nuevaClave = '';
  claveAdmin = '';
  claveEntregada = signal<{ nombre: string; email: string; password: string } | null>(null);
  iaPrueba = signal('');
  iaProbando = signal(false);

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
  readonly especialidades = HOSPITAL_SPECIALTIES;
  readonly generos = GENDERS;
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
  asistenteChat = signal<{ rol: 'admin' | 'ia'; texto: string }[]>([]);
  asistenteEscuchando = signal(false);
  asistenteTranscribiendo = signal(false);
  asistenteVozEnVivo = signal('');
  asistenteResponderVoz = true;
  private asistenteGrabadora: MediaRecorder | null = null;
  private asistenteAudio: Blob[] = [];
  private asistenteReconocimiento: SpeechRecognitionLike | null = null;

  ngOnInit() {
    this.cargarUsuarios();
    this.cargarMedicos();
    this.cargarCitas();
    this.cargarReportes();
    this.cargarAiStatus();
    this.cargarAiMetricas();
  }

  cargarAiStatus() {
    this.ai.status().subscribe({ next: s => this.aiStatus.set(s) });
  }

  cargarAiMetricas() {
    this.adminService.aiMetrics().subscribe({ next: m => this.aiMetricas.set(m) });
  }

  onNavigate(item: SidebarItem) {
    if (!item.tab) return;
    this.tab.set(item.tab as AdminTab);
    this.sub.set((item.sub ?? '') as AdminSub);
    if (item.tab === 'reportes') this.cargarReportes();
    if (item.tab === 'iasuperv') this.cargarAiMetricas();
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

  cargarUsuarios() {
    this.adminService.listUsers().subscribe({ next: u => this.usuarios.set(u) });
  }

  cargarMedicos() {
    this.adminService.listDoctors().subscribe({ next: m => this.medicos.set(m) });
  }

  cargarCitas() {
    this.adminService.superviseAppointments().subscribe({ next: c => this.citas.set(c) });
  }

  citasFiltradas(): Appointment[] {
    const consulta = this.buscarCita.trim().toLocaleLowerCase();
    return this.citas().filter(c => {
      const coincideEstado = !this.estadoCita || c.estado === this.estadoCita;
      const texto = `${c.pacienteNombre} ${c.medicoNombre} ${c.medicoEspecialidad ?? ''} ${c.triageSeveridad ?? ''}`.toLocaleLowerCase();
      return coincideEstado && (!consulta || texto.includes(consulta));
    });
  }

  citasConTriage(): number {
    return this.citas().filter(c => c.triageSeveridad).length;
  }

  citasConEvaluacionPiel(): number {
    return this.citas().filter(c => c.dermatologiaScoreRiesgo != null).length;
  }

  citasUrgentes(): number {
    return this.citas().filter(c => (c.triagePrioridad ?? 0) >= 8 || ['ROJO', 'NARANJA'].includes((c.triageSeveridad ?? '').toUpperCase())).length;
  }

  abrirReprogramacion(cita: Appointment) {
    this.citaAReprogramar.set(cita);
    this.nuevaFechaHora = '';
    this.motivoReprogramacion = '';
    this.mensajeCambio.set('');
  }

  reprogramarCita() {
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
        this.cargarCitas();
      },
      error: e => {
        this.guardandoCambio.set(false);
        this.error.set(e.error?.error ?? 'No se pudo reprogramar la cita.');
      }
    });
  }

  cargarReportes() {
    this.adminService.reports().subscribe({ next: r => this.reporte.set(r) });
  }

  desactivar(id: number) {
    this.cambiarEstado(id, false);
  }

  cambiarEstado(id: number, activo: boolean) {
    this.adminService.setActive(id, activo).subscribe({
      next: () => { this.cargarUsuarios(); this.cargarMedicos(); this.okAdmin.set(activo ? 'Cuenta activada' : 'Cuenta desactivada'); },
      error: (e) => this.error.set(e.error?.error ?? 'No se pudo cambiar el estado')
    });
  }

  editar(u: User) {
    this.editandoId.set(this.idUsuario(u));
    this.claveVisible = u.clave || '';
    this.form = {
      nombre: u.nombre, email: u.email, password: '', rol: u.rol,
      telefono: digitsOnly(u.telefono || ''), documento: this.documentoVisible(u.documento || ''),
      fechaNacimiento: u.fechaNacimiento || '', genero: normalizeGender(u.genero || ''),
      tipoSangre: normalizeBloodType(u.tipoSangre || ''), direccion: u.direccion || '', ciudad: u.ciudad || '',
      alergias: u.alergias || '', contactoEmergencia: u.contactoEmergencia || '',
      telefonoEmergencia: digitsOnly(u.telefonoEmergencia || ''), observaciones: u.observaciones || '',
      especialidad: u.especialidad || '', numeroLicencia: u.numeroLicencia || '',
      consultorio: u.consultorio || '', anosExperiencia: u.anosExperiencia, biografia: u.biografia || '',
      diasAtencion: u.diasAtencion || '', horaInicio: u.horaInicio || '', horaFin: u.horaFin || '',
      horaInicio2: u.horaInicio2 || '', horaFin2: u.horaFin2 || ''
    };
    this.tab.set('usuarios');
    this.sub.set('editar');
    this.error.set('');
  }

  diaMarcado(id: string) {
    return (this.form.diasAtencion || '').split(',').map(s => s.trim()).includes(id);
  }

  toggleDia(id: string) {
    const set = new Set((this.form.diasAtencion || '').split(',').map(s => s.trim()).filter(Boolean));
    if (set.has(id)) set.delete(id);
    else set.add(id);
    this.form.diasAtencion = [...set].sort().join(',');
  }

  telefonoValido(valor?: string) {
    return isColombianPhone(valor || '');
  }

  documentoVisible(valor: string) {
    const texto = (valor || '').trim();
    return /^\d+$/.test(texto) ? texto.slice(0, ID_MAX) : texto;
  }

  alEscribirCedula(valor: string) {
    const texto = valor ?? '';
    if (/[A-Za-z]/.test(texto) && !/\d/.test(texto)) return texto.slice(0, 20);
    return idDigitsOnly(texto);
  }

  cedulaLarga() {
    return (this.form.documento || '').replace(/\D/g, '').length > ID_MAX;
  }

  private telefonoCompleto(valor?: string) {
    const d = digitsOnly(valor || '');
    return !!d && isColombianPhone(d);
  }

  claveCorta() {
    const n = (this.form.password || '').length;
    return n > 0 && n < PASSWORD_MIN;
  }

  textoClave() {
    const n = (this.form.password || '').length;
    if (!n) return `Mínimo ${PASSWORD_MIN} caracteres. Vacía = no cambiar la clave.`;
    if (n < PASSWORD_MIN) return `${n} de ${PASSWORD_MIN} caracteres como mínimo.`;
    return `${n} caracteres. Máximo ${PASSWORD_MAX}.`;
  }

  guardarEdicion() {
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
        this.okAdmin.set('Datos guardados. Si vuelves a editar, vas a ver esta misma ficha.');
        this.claveVisible = guardado.clave || clave || this.claveVisible;
        this.usuarios.update(lista => lista.map(u => this.idUsuario(u) === id ? { ...u, ...guardado, clave: guardado.clave || clave || u.clave } : u));
        this.resetForm();
        this.editandoId.set(null);
        this.cargarUsuarios();
        this.cargarMedicos();
        this.sub.set('lista');
      },
      error: (e) => this.error.set(e.error?.error ?? 'No se pudo actualizar')
    });
  }

  generarClave() {
    const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = new Uint32Array(8);
    crypto.getRandomValues(bytes);
    this.nuevaClave = Array.from(bytes, n => alfabeto[n % alfabeto.length]).join('');
    this.error.set('');
  }

  restablecerClave(u: User) {
    const clave = this.nuevaClave.trim();
    const confirmacion = this.claveAdmin;
    if (clave.length < 6) {
      this.error.set('La nueva clave debe tener al menos 6 caracteres.');
      return;
    }
    if (!confirmacion.trim()) {
      this.error.set('Escribe tu contraseña de administrador para confirmar.');
      return;
    }
    this.error.set('');
    this.adminService.resetPassword(this.idUsuario(u), clave, confirmacion).subscribe({
      next: () => {
        this.claveEntregada.set({ nombre: u.nombre, email: u.email, password: clave });
        this.okAdmin.set('');
        this.nuevaClave = '';
        this.claveAdmin = '';
        this.cargarUsuarios();
      },
      error: (e) => this.error.set(e.error?.error ?? 'No se pudo restablecer')
    });
  }

  textoVisible(texto?: string) {
    return (texto || '')
      .replace(/Gemini\/LLM/gi, 'el asistente')
      .replace(/Gemini visión \+ clasificador local/gi, 'revisión de imagen')
      .replace(/análisis Gemini\/NLP/gi, 'análisis de síntomas')
      .replace(/Gemini revisa interacciones/gi, 'revisión de medicamentos')
      .replace(/estimación Gemini/gi, 'estimación de precios')
      .replace(/Gemini Audio/gi, 'voz')
      .replace(/gemini[\w.\-]*/gi, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\(\s*\)/g, '')
      .trim();
  }

  resultadosBusqueda(): User[] {
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

  probarGemini() {
    this.iaProbando.set(true);
    this.iaPrueba.set('');
    this.adminService.pingAssistant().subscribe({
      next: r => {
        this.iaProbando.set(false);
        const detalle = (r.detalle || '').toLowerCase();
        this.iaPrueba.set(detalle.includes('respond')
          ? 'La prueba respondió bien.'
          : 'La prueba no obtuvo respuesta. Intenta de nuevo en un momento.');
      },
      error: () => {
        this.iaProbando.set(false);
        this.iaPrueba.set('No se pudo hacer la prueba. Intenta de nuevo en un momento.');
      }
    });
  }

  idUsuario(u: User): number {
    return u.usuarioId ?? u.id;
  }

  consultarAsistente() {
    const texto = this.asistenteTexto.trim();
    if (!texto) {
      this.error.set('Escribe el médico o el paciente que quieres crear.');
      return;
    }
    this.error.set('');
    this.okAdmin.set('');
    this.asistenteChat.update(c => [...c, { rol: 'admin', texto }]);
    this.asistenteTexto = '';
    this.asistenteLoading.set(true);
    const historial = this.asistenteBorrador ? [...this.asistenteHistorial] : [];
    this.ai.runAdminOperation({ instruccion: texto, borrador: this.asistenteBorrador || undefined, historial }).subscribe({
      next: r => {
        this.asistenteRsp.set(r);
        const sigue = !(r.accion === 'INFO' && !r.nombre);
        this.asistenteBorrador = sigue ? JSON.stringify(r) : '';
        this.asistenteHistorial = sigue ? [...historial, texto] : [];
        if (r.accion === 'CREAR_MEDICO' || r.accion === 'CREAR_PACIENTE') {
          const falta = this.preguntaSiFalta(r);
          if (falta) {
            this.asistenteLoading.set(false);
            this.responderAsistente(falta);
            return;
          }
          this.crearDesdeAsistente(r);
          return;
        }
        this.asistenteLoading.set(false);
        this.responderAsistente(r.mensaje);
      },
      error: e => {
        this.asistenteLoading.set(false);
        this.error.set(e.error?.error ?? 'No se pudo interpretar la instrucción.');
      }
    });
  }

  private preguntaSiFalta(r: AiAdminOperationResponse): string | null {
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
      if (!this.telefonoCompleto(r.telefono)) faltan.push('un teléfono de 10 dígitos (celular empieza por 3, fijo por 60)');
      if (!r.diasAtencion || !r.horaInicio || !r.horaFin) faltan.push('el horario de atención, con los días y las horas');
    } else {
      if (!r.documento?.trim()) faltan.push('el documento de identidad');
      if (!this.telefonoCompleto(r.telefono)) faltan.push('un teléfono de 10 dígitos (celular empieza por 3, fijo por 60)');
      if (!r.fechaNacimiento || !/^\d{4}-\d{2}-\d{2}$/.test(r.fechaNacimiento)) faltan.push('la fecha de nacimiento');
      if (!normalizeGender(r.genero || '')) faltan.push('el género (masculino, femenino u otro)');
      if (!normalizeBloodType(r.tipoSangre || '')) faltan.push('el tipo de sangre (O+, O-, A+, A-, B+, B-, AB+ o AB-)');
      if (!r.direccion?.trim()) faltan.push('la dirección');
      if (!r.ciudad?.trim()) faltan.push('la ciudad');
      if (!r.alergias?.trim()) faltan.push('las alergias (o «ninguna»)');
      if (!r.contactoEmergencia?.trim()) faltan.push('el contacto de emergencia');
      if (!this.telefonoCompleto(r.telefonoEmergencia)) faltan.push('un teléfono de emergencia de 10 dígitos');
    }
    if (!faltan.length) return null;
    const quien = r.nombre?.trim();
    const lista = faltan.length === 1 ? faltan[0] : `${faltan.slice(0, -1).join(', ')} y ${faltan[faltan.length - 1]}`;
    return quien
      ? `${quien} ya quedó anotado. Para registrarlo me falta ${lista}. Puedes escribirlos como quieras.`
      : `Para registrarlo me falta ${lista}. Puedes escribirlos como quieras.`;
  }

  private crearDesdeAsistente(r: AiAdminOperationResponse) {
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
        this.hablarAsistente(`${tipo} ${r.nombre} registrado. Los datos de acceso están en pantalla.`);
        this.asistenteBorrador = '';
        this.asistenteHistorial = [];
        this.asistenteRsp.set(null);
        this.cargarUsuarios();
        this.cargarMedicos();
        this.cargarReportes();
      },
      error: e => {
        this.asistenteLoading.set(false);
        this.responderAsistente(e.error?.error ?? 'No se pudo crear la cuenta. Corrige el dato y vuelve a enviarlo.');
      }
    });
  }

  private responderAsistente(texto: string) {
    this.asistenteChat.update(c => [...c, { rol: 'ia', texto }]);
    this.hablarAsistente(texto);
  }

  private hablarAsistente(texto: string) {
    if (!this.asistenteResponderVoz || typeof speechSynthesis === 'undefined') return;
    speechSynthesis.cancel();
    const voz = new SpeechSynthesisUtterance(texto.slice(0, 600));
    voz.lang = 'es-CO';
    voz.rate = 1;
    const es = speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith('es'));
    if (es) voz.voice = es;
    speechSynthesis.speak(voz);
  }

  async alternarMicrofonoAsistente() {
    if (this.asistenteEscuchando()) {
      this.detenerMicrofonoAsistente();
      return;
    }
    this.error.set('');
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      this.error.set('Este navegador no permite grabar audio. Escribe los datos.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.asistenteAudio = [];
      this.asistenteVozEnVivo.set('');
      this.asistenteGrabadora = new MediaRecorder(stream);
      this.asistenteGrabadora.ondataavailable = event => {
        if (event.data.size) this.asistenteAudio.push(event.data);
      };
      this.asistenteGrabadora.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const audio = new Blob(this.asistenteAudio, { type: this.asistenteGrabadora?.mimeType || 'audio/webm' });
        this.enviarVozAsistente(audio);
      };
      this.asistenteGrabadora.start();
      this.asistenteEscuchando.set(true);
      this.escucharEnVivoAsistente();
    } catch {
      this.error.set('No se pudo acceder al micrófono. Revisa los permisos del navegador.');
    }
  }

  private detenerMicrofonoAsistente() {
    this.asistenteReconocimiento?.stop();
    this.asistenteReconocimiento = null;
    this.asistenteEscuchando.set(false);
    if (this.asistenteGrabadora?.state === 'recording') this.asistenteGrabadora.stop();
  }

  private escucharEnVivoAsistente() {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionFactory;
      webkitSpeechRecognition?: SpeechRecognitionFactory;
    };
    const Factory = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Factory) return;
    this.asistenteReconocimiento = new Factory();
    this.asistenteReconocimiento.lang = 'es-CO';
    this.asistenteReconocimiento.continuous = true;
    this.asistenteReconocimiento.interimResults = true;
    this.asistenteReconocimiento.onresult = event => {
      this.asistenteVozEnVivo.set(Array.from(event.results).map(result => result[0].transcript).join(' '));
    };
    this.asistenteReconocimiento.onerror = () => undefined;
    try {
      this.asistenteReconocimiento.start();
    } catch {
      this.asistenteReconocimiento = null;
    }
  }

  private enviarVozAsistente(audio: Blob) {
    const enVivo = this.asistenteVozEnVivo().trim();
    const enviar = (texto: string, motivo?: string) => {
      this.asistenteTranscribiendo.set(false);
      this.asistenteVozEnVivo.set('');
      if (!texto) {
        const navegador = this.navegadorSinVoz()
          ? ' Este navegador no reconoce la voz por sí mismo; en Chrome o Edge funciona.'
          : '';
        this.error.set((motivo || 'No se entendió el audio. Habla de nuevo o escribe los datos.') + navegador);
        return;
      }
      this.asistenteTexto = texto;
      this.consultarAsistente();
    };
    if (!audio.size) {
      enviar(enVivo);
      return;
    }
    this.asistenteTranscribiendo.set(true);
    this.ai.transcribe(audio).subscribe({
      next: result => enviar(result.texto.trim() || enVivo, result.mensaje),
      error: () => enviar(enVivo)
    });
  }

  private navegadorSinVoz(): boolean {
    const w = window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    const nav = navigator as Navigator & { brave?: unknown };
    return !(w.SpeechRecognition || w.webkitSpeechRecognition) || !!nav.brave;
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

  etiqueta(c: Appointment) {
    return etiquetaCita(c);
  }

  badgeClass(estado: string): string {
    return 'badge badge-' + estado.toLowerCase();
  }

  severidadSobreprecioColor(eval_: string): string {
    switch ((eval_ || '').toUpperCase()) {
      case 'SOBREPRECIO_ALTO':
      case 'DESABASTECIMIENTO_ARTIFICIAL': return 'bg-red';
      case 'SOBREPRECIO_BAJO': return 'bg-orange';
      case 'DENTRO_RANGO': return 'bg-green';
      default: return 'bg-blue';
    }
  }

  severidadSobreprecioLabel(eval_: string): string {
    switch ((eval_ || '').toUpperCase()) {
      case 'SOBREPRECIO_ALTO': return 'SOBREPRECIO ALTO';
      case 'DESABASTECIMIENTO_ARTIFICIAL': return 'DESABASTECIMIENTO ARTIFICIAL';
      case 'SOBREPRECIO_BAJO': return 'SOBREPRECIO BAJO';
      case 'DENTRO_RANGO': return 'DENTRO DE RANGO';
      default: return eval_ || '—';
    }
  }

  preciosAnalizar() {
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

  severidadEntries(dist: { [key: string]: number }): { key: string; value: number }[] {
    if (!dist) return [];
    return Object.entries(dist).map(([key, value]) => ({ key, value }));
  }

  severidadBarColor(sev: string): string {
    const s = sev.toLowerCase();
    if (s.includes('rojo')) return 'bar-red';
    if (s.includes('naranja')) return 'bar-orange';
    if (s.includes('amarillo')) return 'bar-yellow';
    if (s.includes('verde')) return 'bar-green';
    return 'bar-blue';
  }

  iniciales(nombre?: string): string {
    const parts = (nombre || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'A';
    return parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');
  }

  fechaHoy(): string {
    return new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) + ' · Hoy';
  }

  citasHoy(): number {
    const hoy = new Date().toDateString();
    return this.citas().filter(c => new Date(c.fechaHora).toDateString() === hoy).length;
  }

  puntosMensuales(): { label: string; nombre: string; x: number; y: number; total: number }[] {
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

  mesVisible(): number | null {
    return this.mesSobre() ?? this.mesFijo();
  }

  tocarMes(indice: number) {
    this.mesFijo.set(this.mesFijo() === indice ? null : indice);
  }

  donutVisible(): string | null {
    return this.donutSobre() ?? this.donutFijo();
  }

  tocarDonut(etiqueta: string) {
    this.donutFijo.set(this.donutFijo() === etiqueta ? null : etiqueta);
  }

  lineaMensual(): string {
    return this.puntosMensuales().map(p => `${p.x},${p.y}`).join(' ');
  }

  barrasMes(): { nombre: string; total: number; alto: number }[] {
    const meses = this.reporte()?.desgloseMensual ?? [];
    const max = Math.max(...meses.map(m => m.totalCitas), 1);
    return meses.map(m => ({
      nombre: (m.nombreMes || '').slice(0, 3),
      total: m.totalCitas,
      alto: Math.max(6, (m.totalCitas / max) * 120)
    }));
  }

  estadosCita(): { label: string; total: number; color: string; ancho: number }[] {
    const r = this.reporte();
    if (!r) return [];
    const items = [
      { label: 'Pendientes', total: r.citasPendientes, color: '#f59e0b' },
      { label: 'Aceptadas', total: r.citasAceptadas, color: '#16a34a' },
      { label: 'Canceladas', total: r.citasCanceladas, color: '#94a3b8' }
    ];
    const max = Math.max(...items.map(i => i.total), 1);
    return items.map(i => ({ ...i, ancho: (i.total / max) * 100 }));
  }

  donutEspecialidades(): { label: string; color: string; dash: number; gap: number; offset: number; porcentaje: number; total: number }[] {
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

  alertasSistema(): { titulo: string; detalle: string }[] {
    const items: { titulo: string; detalle: string }[] = [];
    const m = this.aiMetricas();
    if (this.citasUrgentes()) {
      items.push({
        titulo: `${this.citasUrgentes()} cita(s) de prioridad alta`,
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

  rendimiento(): { label: string; valor: string; detalle: string }[] {
    const r = this.reporte();
    const m = this.aiMetricas();
    const total = r?.totalCitas || 0;
    const aceptadas = r?.citasAceptadas || 0;
    const triage = m?.citasConTriage || 0;
    const pct = (n: number) => total ? `${Math.round((n / total) * 100)}%` : '0%';
    return [
      { label: 'Citas aceptadas', valor: pct(aceptadas), detalle: `${aceptadas} de ${total}` },
      { label: 'Con triage', valor: pct(triage), detalle: `${triage} citas orientadas` },
      { label: 'Asistente', valor: m?.apiKeyActiva ? 'Activo' : 'En espera', detalle: m?.apiKeyActiva ? 'Listo para usar' : 'Sin conexión' }
    ];
  }

}
