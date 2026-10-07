import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { AdminService } from '../../services/admin.service';
import { Usuario, UsuarioRequest } from '../../models/usuario.model';
import { Cita } from '../../models/cita.model';
import { Reporte } from '../../models/reporte.model';
import { PortalSidebarComponent, SidebarItem } from '../portal-sidebar/portal-sidebar.component';
import { SessionTimeoutComponent } from '../session-timeout/session-timeout.component';
import { AiService } from '../../services/ai.service';
import { AiPreciosRequest, AiPreciosResponse } from '../../models/ai.model';
import { AiMetricas } from '../../models/ai-metricas.model';

type AdminTab = 'inicio' | 'usuarios' | 'medicos' | 'citas' | 'reportes' | 'iasuperv' | 'preciosauditoria';
type AdminSub = '' | 'lista' | 'crear' | 'editar' | 'claves' | 'supervision' | 'resumen' | 'mensual';

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
  expandedMenus = signal<string[]>(['usuarios', 'medicos', 'citas', 'reportes']);

  readonly menuItems: SidebarItem[] = [
    { id: 'inicio', label: 'Inicio', icon: '🏠', tab: 'inicio' },
    {
      id: 'usuarios',
      label: 'Usuarios',
      icon: '👥',
      children: [
        { id: 'u-lista', label: 'Listar usuarios', tab: 'usuarios', sub: 'lista' },
        { id: 'u-crear', label: 'Registrar paciente', tab: 'usuarios', sub: 'crear' },
        { id: 'u-claves', label: 'Accesos y claves', tab: 'usuarios', sub: 'claves' }
      ]
    },
    {
      id: 'medicos',
      label: 'Médicos',
      icon: '🩺',
      children: [
        { id: 'm-lista', label: 'Listar médicos', tab: 'medicos', sub: 'lista' },
        { id: 'm-crear', label: 'Registrar médico', tab: 'medicos', sub: 'crear' }
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
        { id: 'ia-superv', label: 'Supervisión IA', tab: 'iasuperv' },
        { id: 'ia-precios', label: 'Auditoría precios', tab: 'preciosauditoria' }
      ]
    }
  ];

  usuarios = signal<Usuario[]>([]);
  medicos = signal<Usuario[]>([]);
  citas = signal<Cita[]>([]);
  buscarCita = '';
  estadoCita = '';
  citaAReprogramar = signal<Cita | null>(null);
  nuevaFechaHora = '';
  motivoReprogramacion = '';
  mensajeCambio = signal('');
  guardandoCambio = signal(false);
  reporte = signal<Reporte | null>(null);

  form: UsuarioRequest = {
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
  aiMetricas = signal<AiMetricas | null>(null);

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
      preciosauditoria: 'IA — Auditoría de precios'
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

  citasFiltradas(): Cita[] {
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

  abrirReprogramacion(cita: Cita) {
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

  crearUsuario() {
    this.error.set('');
    if (this.tab() === 'medicos') {
      if (!this.form.especialidad?.trim()) {
        this.error.set('Indica la especialidad del médico.');
        return;
      }
      this.adminService.crearMedico({ ...this.form, rol: 'MEDICO' }).subscribe({
        next: () => { this.resetForm(); this.cargarMedicos(); this.cargarUsuarios(); this.sub.set('lista'); },
        error: (e) => this.error.set(e.error?.error ?? 'Error al crear médico')
      });
      return;
    }
    if (!this.form.documento?.trim()) {
      this.error.set('El paciente requiere documento.');
      return;
    }
    this.adminService.crearUsuario({ ...this.form, rol: 'PACIENTE' }).subscribe({
      next: () => { this.resetForm(); this.cargarUsuarios(); this.sub.set('lista'); },
      error: (e) => this.error.set(e.error?.error ?? 'Error al crear paciente')
    });
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

  editar(u: Usuario) {
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
        this.okAdmin.set('Usuario actualizado');
        this.resetForm();
        this.editandoId.set(null);
        this.cargarUsuarios();
        this.cargarMedicos();
        this.sub.set('lista');
      },
      error: (e) => this.error.set(e.error?.error ?? 'No se pudo actualizar')
    });
  }

  restablecerClave(u: Usuario) {
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

  idUsuario(u: Usuario): number {
    return u.usuarioId ?? u.id;
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
