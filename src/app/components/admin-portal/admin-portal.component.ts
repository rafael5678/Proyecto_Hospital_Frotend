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
type AdminSub = '' | 'lista' | 'crear' | 'supervision' | 'resumen' | 'mensual';

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

  tab = signal<AdminTab>('usuarios');
  sub = signal<AdminSub>('lista');
  expandedMenus = signal<string[]>(['usuarios', 'medicos', 'citas', 'reportes']);

  readonly menuItems: SidebarItem[] = [
    { id: 'inicio', label: 'Inicio', icon: '🏠', tab: 'inicio' },
    {
      id: 'usuarios',
      label: 'Usuarios',
      icon: '👥',
      children: [
        { id: 'u-lista', label: 'Listar usuarios', tab: 'usuarios', sub: 'lista' },
        { id: 'u-crear', label: 'Registrar paciente', tab: 'usuarios', sub: 'crear' }
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
    this.adminService.desactivarUsuario(id).subscribe({ next: () => this.cargarUsuarios() });
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

}
