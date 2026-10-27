import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { AdminService } from '../../services/admin.service';
import { User, UserRequest } from '../../models/user.model';
import { Appointment } from '../../models/appointment.model';
import { Report } from '../../models/report.model';
import { PortalSidebarComponent, SidebarItem } from '../portal-sidebar/portal-sidebar.component';
import { SessionTimeoutComponent } from '../session-timeout/session-timeout.component';
import { AiService } from '../../services/ai.service';
import { AiAdminOperationResponse, AiPricesRequest, AiPricesResponse } from '../../models/ai.model';
import { AiMetrics } from '../../models/ai.model';
import { HOSPITAL_SPECIALTIES } from '../../data/specialties';

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
  imports: [FormsModule, DatePipe, DecimalPipe, PortalSidebarComponent, SessionTimeoutComponent],
  templateUrl: './admin-portal.component.html',
  styleUrl: './admin-portal.component.css'
})
export class AdminPortalComponent implements OnInit {
  auth = inject(AuthService);
  private adminService = inject(AdminService);
  private ai = inject(AiService);

  tab = signal<AdminTab>('inicio');
  sub = signal<AdminSub>('');
  expandedMenus = signal<string[]>(['usuarios', 'medicos', 'citas', 'reportes', 'ia']);

  readonly menuItems: SidebarItem[] = [
    { id: 'inicio', label: 'Inicio', icon: '🏠', tab: 'inicio' },
    {
      id: 'usuarios',
      label: 'Usuarios',
      icon: '👥',
      children: [
        { id: 'u-lista', label: 'Listar usuarios', tab: 'usuarios', sub: 'lista' },
        { id: 'u-claves', label: 'Accesos y claves', tab: 'usuarios', sub: 'claves' }
      ]
    },
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
      label: 'Inteligencia Artificial',
      icon: '🤖',
      children: [
        { id: 'ia-asist', label: 'Registro Hospy', tab: 'asistente' },
        { id: 'ia-superv', label: 'Supervisión IA', tab: 'iasuperv' },
        { id: 'ia-precios', label: 'Auditoría precios', tab: 'preciosauditoria' }
      ]
    }
  ];

  usuarios = signal<User[]>([]);
  medicos = signal<User[]>([]);
  citas = signal<Appointment[]>([]);
  buscarCita = '';
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
  nuevaClave = '';

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
    this.adminService.aiMetricas().subscribe({ next: m => this.aiMetricas.set(m) });
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
      iasuperv: 'IA — Supervisión y estado',
      preciosauditoria: 'IA — Auditoría de precios',
      asistente: 'Registro Hospy'
    };
    return map[`${t}-${s}`] ?? map[t] ?? 'Administración';
  }

  cargarUsuarios() {
    this.adminService.listarUsuarios().subscribe({ next: u => this.usuarios.set(u) });
  }

  cargarMedicos() {
    this.adminService.listarMedicos().subscribe({ next: m => this.medicos.set(m) });
  }

  cargarCitas() {
    this.adminService.supervisarCitas().subscribe({ next: c => this.citas.set(c) });
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
    this.adminService.reprogramarCita(cita.id, `${this.nuevaFechaHora}:00`, this.motivoReprogramacion.trim()).subscribe({
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
    this.adminService.reportes().subscribe({ next: r => this.reporte.set(r) });
  }

  desactivar(id: number) {
    this.cambiarEstado(id, false);
  }

  cambiarEstado(id: number, activo: boolean) {
    this.adminService.cambiarEstado(id, activo).subscribe({
      next: () => { this.cargarUsuarios(); this.cargarMedicos(); this.okAdmin.set(activo ? 'Cuenta activada' : 'Cuenta desactivada'); },
      error: (e) => this.error.set(e.error?.error ?? 'No se pudo cambiar el estado')
    });
  }

  editar(u: User) {
    this.editandoId.set(this.idUsuario(u));
    this.form = {
      nombre: u.nombre, email: u.email, password: '', rol: u.rol,
      telefono: u.telefono || '', documento: u.documento || '', especialidad: u.especialidad || '',
      fechaNacimiento: '', genero: '', ciudad: '', alergias: '',
      numeroLicencia: '', consultorio: u.consultorio || '', anosExperiencia: u.anosExperiencia, biografia: u.biografia || ''
    };
    this.tab.set('usuarios');
    this.sub.set('editar');
    this.error.set('');
  }

  guardarEdicion() {
    const id = this.editandoId();
    if (!id) return;
    this.adminService.actualizarUsuario(id, { ...this.form, password: this.form.password || undefined }).subscribe({
      next: () => {
        this.okAdmin.set('User actualizado');
        this.resetForm();
        this.editandoId.set(null);
        this.cargarUsuarios();
        this.cargarMedicos();
        this.sub.set('lista');
      },
      error: (e) => this.error.set(e.error?.error ?? 'No se pudo actualizar')
    });
  }

  restablecerClave(u: User) {
    if (!this.nuevaClave.trim() || this.nuevaClave.trim().length < 6) {
      this.error.set('La nueva clave debe tener al menos 6 caracteres.');
      return;
    }
    this.adminService.actualizarUsuario(this.idUsuario(u), {
      nombre: u.nombre, email: u.email, rol: u.rol, password: this.nuevaClave.trim()
    }).subscribe({
      next: () => { this.okAdmin.set(`Clave restablecida para ${u.email}. Entrégasela al usuario; no se vuelve a mostrar.`); this.nuevaClave = ''; this.cargarUsuarios(); },
      error: (e) => this.error.set(e.error?.error ?? 'No se pudo restablecer')
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
    this.ai.adminOperacion({ instruccion: texto, borrador: this.asistenteBorrador || undefined, historial }).subscribe({
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
    if (!r.passwordSugerida || r.passwordSugerida.length < 6) faltan.push('la contraseña (mínimo 6 caracteres)');
    if (medico) {
      if (!r.especialidad?.trim()) faltan.push('la especialidad');
      if (r.anosExperiencia == null) faltan.push('los años de experiencia');
      if (!r.numeroLicencia?.trim()) faltan.push('el número de licencia');
      if (!r.telefono || r.telefono.replace(/\D/g, '').length < 7) faltan.push('el teléfono');
      if (!r.diasAtencion || !r.horaInicio || !r.horaFin) faltan.push('el horario de atención, con los días y las horas');
    } else {
      if (!r.documento?.trim()) faltan.push('el documento de identidad');
      if (!r.telefono || r.telefono.replace(/\D/g, '').length < 7) faltan.push('el teléfono');
      if (!r.fechaNacimiento || !/^\d{4}-\d{2}-\d{2}$/.test(r.fechaNacimiento)) faltan.push('la fecha de nacimiento');
      if (!r.genero?.trim()) faltan.push('el género');
      if (!r.tipoSangre?.trim()) faltan.push('el tipo de sangre');
      if (!r.direccion?.trim()) faltan.push('la dirección');
      if (!r.ciudad?.trim()) faltan.push('la ciudad');
      if (!r.alergias?.trim()) faltan.push('las alergias (o «ninguna»)');
      if (!r.contactoEmergencia?.trim()) faltan.push('el contacto de emergencia');
      if (!r.telefonoEmergencia?.trim()) faltan.push('el teléfono de emergencia');
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
      telefono: r.telefono || '',
      ciudad: r.ciudad || '',
      genero: r.genero || '',
      alergias: r.alergias || '',
      fechaNacimiento: r.fechaNacimiento || ''
    };
    const alta = r.accion === 'CREAR_MEDICO'
      ? this.adminService.crearMedico({
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
      : this.adminService.crearUsuario({
          ...comun,
          rol: 'PACIENTE',
          documento: r.documento || '',
          tipoSangre: r.tipoSangre || '',
          direccion: r.direccion || '',
          contactoEmergencia: r.contactoEmergencia || '',
          telefonoEmergencia: r.telefonoEmergencia || '',
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
          ? ' Este navegador no reconoce la voz por sí mismo; en Chrome o Edge funciona aunque Gemini esté ocupado.'
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
    this.ai.transcribir(audio).subscribe({
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
    this.ai.precios(this.preciosReq).subscribe({
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

  puntosMensuales(): { label: string; x: number; y: number; total: number }[] {
    const meses = this.reporte()?.desgloseMensual ?? [];
    if (!meses.length) return [];
    const max = Math.max(...meses.map(m => m.totalCitas), 1);
    return meses.map((m, i) => ({
      label: (m.nombreMes || '').slice(0, 3),
      total: m.totalCitas,
      x: meses.length === 1 ? 180 : 20 + (i * (320 / (meses.length - 1))),
      y: 140 - (m.totalCitas / max) * 110
    }));
  }

  lineaMensual(): string {
    return this.puntosMensuales().map(p => `${p.x},${p.y}`).join(' ');
  }

  donutEspecialidades(): { label: string; color: string; dash: number; gap: number; offset: number; porcentaje: number }[] {
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
        porcentaje: Math.round(pct * 100)
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
        titulo: 'IA en modo demostración',
        detalle: `${m.versionIa} · sin API key activa.`
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
      { label: 'Con triage IA', valor: pct(triage), detalle: `${triage} citas orientadas` },
      { label: 'IA clínica', valor: m?.apiKeyActiva ? 'Activa' : 'Demo', detalle: m?.versionIa || 'Sin métricas' }
    ];
  }

}
