import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { PacienteService } from '../../services/paciente.service';
import { AiService } from '../../services/ai.service';
import { Cita } from '../../models/cita.model';
import { Usuario } from '../../models/usuario.model';
import { Horario } from '../../models/horario.model';
import { PacienteDashboard, PacientePerfil } from '../../models/paciente-perfil.model';
import {
  AiDermatologiaRequest, AiDermatologiaResponse,
  AiInteraccionRequest, AiInteraccionResponse,
  AiPreciosRequest, AiPreciosResponse,
  AiTriageRequest, AiTriageResponse
} from '../../models/ai.model';
import { PortalSidebarComponent, SidebarItem } from '../portal-sidebar/portal-sidebar.component';

type PacienteTab = 'inicio' | 'agendar' | 'historial' | 'proximas' | 'medicos' | 'perfil'
  | 'triage' | 'dermatologia' | 'interacciones' | 'precios';
type PacienteSub = '' | 'agendar' | 'historial' | 'proximas' | 'directorio' | 'editar'
  | 'triage' | 'derm' | 'inter' | 'precios';

@Component({
  selector: 'app-paciente-portal',
  standalone: true,
  imports: [FormsModule, DatePipe, PortalSidebarComponent],
  templateUrl: './paciente-portal.component.html',
  styleUrl: './paciente-portal.component.css'
})
export class PacientePortalComponent implements OnInit {
  auth = inject(AuthService);
  private svc = inject(PacienteService);
  private ai = inject(AiService);

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
      label: 'IA Hospitalaria',
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

  dashboard = signal<PacienteDashboard | null>(null);
  perfil = signal<PacientePerfil | null>(null);
  medicos = signal<Usuario[]>([]);
  medicoDetalle = signal<Usuario | null>(null);
  horarios = signal<Horario[]>([]);
  citas = signal<Cita[]>([]);
  proximas = signal<Cita[]>([]);

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

  /* ======= IA: Triage NLP ======= */
  triageReq: AiTriageRequest = { sintomas: '', duracion: '', antecedentes: '' };
  triageRsp = signal<AiTriageResponse | null>(null);
  triageLoading = signal(false);

  /* ======= IA: Dermatologia CNN ======= */
  dermReq: AiDermatologiaRequest = { descripcion: '', tiempoEvolucion: '', sintomasAsociados: '' };
  dermRsp = signal<AiDermatologiaResponse | null>(null);
  dermLoading = signal(false);

  /* ======= IA: Interacciones GNN ======= */
  interMed = '';       /* comma list */
  interDieta = '';     /* comma list */
  interSuplem = '';    /* comma list */
  interRsp = signal<AiInteraccionResponse | null>(null);
  interLoading = signal(false);

  /* ======= IA: Precios / Prophet ======= */
  preciosReq: AiPreciosRequest = { medicamento: '', presentacion: '', ciudad: '' };
  preciosPrecioTxt = '';
  preciosRsp = signal<AiPreciosResponse | null>(null);
  preciosLoading = signal(false);

  ngOnInit() {
    this.cargarInicio();
    this.cargarMedicos();
    this.cargarHistorial();
    this.cargarPerfilYAntecedentes();
  }

  onNavigate(item: SidebarItem) {
    if (!item.tab) return;
    this.tab.set(item.tab as PacienteTab);
    this.sub.set((item.sub ?? '') as PacienteSub);
    this.error.set('');
    this.ok.set('');
    if (item.tab === 'perfil' || item.tab === 'agendar') this.cargarPerfilYAntecedentes();
    if (item.tab === 'proximas') this.svc.proximas().subscribe({ next: c => this.proximas.set(c) });
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
      agendar: 'Agendar cita (triage + piel + médico)',
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

  cargarInicio() {
    this.svc.dashboard().subscribe({ next: d => this.dashboard.set(d) });
    this.svc.proximas().subscribe({ next: c => this.proximas.set(c) });
  }

  cargarPerfil() {
    this.cargarPerfilYAntecedentes();
  }

  cargarPerfilYAntecedentes() {
    this.svc.perfil().subscribe({
      next: p => {
        this.perfil.set({ ...p });
        if (!this.antecedentesSintomas) {
          this.antecedentesSintomas = [p.alergias, p.observaciones].filter(Boolean).join(' · ');
        }
      }
    });
  }

  cargarMedicos() {
    this.svc.listarMedicos().subscribe({ next: m => this.medicos.set(m) });
  }

  medicosFiltrados(): Usuario[] {
    const lista = this.medicos();
    const sugerida = (this.triageRsp()?.especialidadRecomendada || this.filtroEspecialidad).toLowerCase();
    if (!sugerida) return lista;
    return [...lista].sort((a, b) => {
      const am = a.especialidad?.toLowerCase().includes(sugerida) ? 0 : 1;
      const bm = b.especialidad?.toLowerCase().includes(sugerida) ? 0 : 1;
      return am - bm;
    });
  }

  puedeAgendar(): boolean {
    if (this.loading() || this.triageLoading() || this.dermLoading()) return false;
    if (!this.sintomas.trim() || !this.consentimientoTriage || !this.medicoId || !this.fechaHora) return false;
    if (this.tieneLesionPiel && !this.puedeAnalizarPiel()) return false;
    return true;
  }

  puedeAnalizarPiel(): boolean {
    return !!(this.dermReq.descripcion?.trim() || this.dermReq.imagenBase64);
  }

  onPielToggle() {
    if (!this.tieneLesionPiel) {
      this.dermReq.descripcion = '';
      this.quitarFotoPiel();
      this.dermRsp.set(null);
    }
  }

  onFotoPiel(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.error.set('Sube una foto en JPG o PNG.');
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
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  quitarFotoPiel() {
    this.dermReq.imagenBase64 = undefined;
    this.dermFotoPreview.set(null);
    this.dermFotoNombre = '';
  }

  especialidadObjetivo(): string {
    if (this.tieneLesionPiel && this.dermRsp()) return 'Dermatología';
    return this.triageRsp()?.especialidadRecomendada || this.filtroEspecialidad || '';
  }

  medicoAsignado(): Usuario | null {
    return this.medicos().find(m => m.id === this.medicoId) ?? null;
  }

  asignarMedicoSegunAnalisis() {
    const esp = this.especialidadObjetivo();
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
      this.onMedicoChange();
      return;
    }
    this.avisoMedico.set(`No hay un médico de ${esp} en el directorio. Elige otro o se asignará más adelante.`);
  }

  private fechaParaApi(): string {
    const f = this.fechaHora;
    if (!f) return '';
    return f.length === 16 ? `${f}:00` : f;
  }

  verMedico(m: Usuario) {
    this.medicoDetalle.set(m);
    this.tab.set('medicos');
    this.sub.set('directorio');
    this.svc.horariosMedico(m.id).subscribe({ next: h => this.horarios.set(h) });
  }

  onMedicoChange() {
    if (!this.medicoId) return;
    this.svc.horariosMedico(this.medicoId).subscribe({ next: h => this.horarios.set(h) });
  }

  cargarHistorial() {
    this.svc.historial().subscribe({ next: c => this.citas.set(c) });
  }

  agendar() {
    if (!this.puedeAgendar()) {
      this.error.set('Completa los campos obligatorios (*). La piel solo es obligatoria si marcaste que tienes una lesión.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const enviar = () => {
      const triage = this.triageRsp();
      const dermatologia = this.tieneLesionPiel ? this.dermRsp() : null;
      this.svc.agendarCita({
        medicoId: this.medicoId!,
        fechaHora: this.fechaParaApi(),
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
          this.quitarFotoPiel();
          this.avisoMedico.set('');
          this.cargarInicio();
          this.cargarHistorial();
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
      if (this.tieneLesionPiel && this.puedeAnalizarPiel() && !this.dermRsp()) {
        this.ai.dermatologia({ ...this.dermReq }).subscribe({
          next: r => {
            this.dermRsp.set(r);
            this.asignarMedicoSegunAnalisis();
            enviar();
          },
          error: () => enviar()
        });
        return;
      }
      enviar();
    };

    if (!this.triageRsp()) {
      this.triageReq = {
        sintomas: this.sintomas,
        duracion: this.duracionSintomas,
        antecedentes: this.antecedentesSintomas,
        edadPaciente: this.triageReq.edadPaciente
      };
      this.ai.triage({ ...this.triageReq }).subscribe({
        next: r => { this.triageRsp.set(r); despuesTriage(); },
        error: () => despuesTriage()
      });
      return;
    }
    despuesTriage();
  }

  guardarPerfil() {
    const p = this.perfil();
    if (!p) return;
    this.guardandoPerfil.set(true);
    this.svc.actualizarPerfil(p).subscribe({
      next: (res) => {
        this.perfil.set(res);
        this.guardandoPerfil.set(false);
        this.ok.set('Perfil actualizado');
      },
      error: (e) => {
        this.guardandoPerfil.set(false);
        this.error.set(e.error?.error ?? 'Error al guardar');
      }
    });
  }

  cancelar(id: number) {
    if (!confirm('¿Cancelar esta cita?')) return;
    this.svc.cancelarCita(id).subscribe({
      next: () => { this.cargarHistorial(); this.cargarInicio(); },
      error: (e) => this.error.set(e.error?.error ?? 'Error')
    });
  }

  irAgendarConMedico(m: Usuario) {
    this.medicoId = m.id;
    this.medicoDetalle.set(null);
    this.tab.set('agendar');
    this.sub.set('agendar');
    this.onMedicoChange();
  }

  /* ============ Inteligencia Artificial ============ */
  triageAnalizar() {
    if (!this.consentimientoTriage) {
      this.error.set('Autoriza el envío de tus datos de salud al servicio de IA para continuar.');
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
      this.triageReq = {
        sintomas: this.sintomas,
        duracion: this.duracionSintomas,
        antecedentes: this.antecedentesSintomas,
        edadPaciente: this.triageReq.edadPaciente
      };
    } else {
      this.sintomas = this.triageReq.sintomas || '';
      this.duracionSintomas = this.triageReq.duracion || '';
      this.antecedentesSintomas = this.triageReq.antecedentes || '';
    }

    this.ai.triage({ ...this.triageReq }).subscribe({
      next: (r) => {
        this.triageRsp.set(r);
        this.triageLoading.set(false);
        this.filtroEspecialidad = r.especialidadRecomendada || '';
        this.asignarMedicoSegunAnalisis();
        if (this.tieneLesionPiel && this.puedeAnalizarPiel()) this.dermAnalizar();
      }
    });
  }

  dermAnalizar() {
    if (!this.puedeAnalizarPiel()) {
      this.error.set('Describe la lesión o sube una foto de evidencia.');
      return;
    }
    this.dermLoading.set(true);
    this.error.set('');
    this.dermRsp.set(null);
    this.ai.dermatologia({ ...this.dermReq }).subscribe({
      next: (r) => {
        this.dermRsp.set(r);
        this.dermLoading.set(false);
        this.asignarMedicoSegunAnalisis();
      }
    });
  }

  triageCambiar() {
    this.triageRsp.set(null);
    this.dermRsp.set(null);
  }

  interAnalizar() {
    const meds = this.commaList(this.interMed);
    if (meds.length === 0) {
      this.error.set('Ingresa al menos 1 medicamento separado por comas.');
      return;
    }
    const req: AiInteraccionRequest = {
      medicamentos: meds,
      dietaHabitual: this.commaList(this.interDieta),
      suplementos: this.commaList(this.interSuplem)
    };
    this.interLoading.set(true);
    this.error.set('');
    this.interRsp.set(null);
    this.ai.interacciones(req).subscribe({
      next: (r) => { this.interRsp.set(r); this.interLoading.set(false); }
    });
  }

  preciosAnalizar() {
    if (!this.preciosReq.medicamento.trim()) {
      this.error.set('Ingresa el nombre del medicamento a comparar.');
      return;
    }
    const precio = this.preciosPrecioTxt ? parseFloat(this.preciosPrecioTxt) : undefined;
    const req: AiPreciosRequest = {
      ...this.preciosReq,
      precioReportado: !isNaN(precio as number) ? precio : undefined
    };
    this.preciosLoading.set(true);
    this.error.set('');
    this.preciosRsp.set(null);
    this.ai.precios(req).subscribe({
      next: (r) => { this.preciosRsp.set(r); this.preciosLoading.set(false); }
    });
  }

  private commaList(s: string): string[] {
    if (!s) return [];
    return s.split(/[,;]/).map(x => x.trim()).filter(Boolean);
  }

  severidadColor(sev: string): string {
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

  primerNombre(): string {
    const nombre = this.auth.user()?.nombre || this.perfil()?.nombre || 'paciente';
    return nombre.trim().split(/\s+/)[0];
  }

  iniciales(nombre?: string): string {
    const parts = (nombre || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'P';
    return parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');
  }

  proximaCita(): Cita | null {
    const ahora = Date.now();
    return this.proximas()
      .filter(c => !['CANCELADA', 'RECHAZADA'].includes((c.estado || '').toUpperCase()))
      .filter(c => {
        const t = new Date(c.fechaHora).getTime();
        return !Number.isNaN(t) && t >= ahora;
      })
      .slice()
      .sort((a, b) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime())[0] ?? null;
  }

  irA(tab: PacienteTab, sub: PacienteSub = '') {
    this.onNavigate({ id: tab, label: '', tab, sub });
  }

  formatFechaCita(iso: string): string {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return iso;
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const hora = fecha.getHours();
    const minutos = fecha.getMinutes().toString().padStart(2, '0');
    const sufijo = hora >= 12 ? 'p.m.' : 'a.m.';
    const hora12 = ((hora + 11) % 12) + 1;
    return `${fecha.getDate()} de ${meses[fecha.getMonth()]} de ${fecha.getFullYear()} · ${hora12}:${minutos} ${sufijo}`;
  }

  notificacionesPaciente(): { titulo: string; detalle: string }[] {
    const items: { titulo: string; detalle: string }[] = [];
    const proxima = this.proximaCita();
    const dash = this.dashboard();
    const perfil = this.perfil();
    if (proxima) {
      items.push({
        titulo: `Próxima cita con ${proxima.medicoNombre}`,
        detalle: `${this.formatFechaCita(proxima.fechaHora)} · ${proxima.medicoEspecialidad || 'Consulta'}`
      });
    }
    if (dash?.citasPendientes) {
      items.push({
        titulo: `${dash.citasPendientes} cita(s) pendiente(s)`,
        detalle: 'El médico aún no confirma la solicitud.'
      });
    }
    if (perfil?.alergias) {
      items.push({
        titulo: 'Alergias registradas',
        detalle: perfil.alergias
      });
    }
    if (!items.length) {
      items.push({
        titulo: 'Sin novedades clínicas',
        detalle: 'Cuando tengas citas o datos en tu perfil, aparecerán aquí.'
      });
    }
    return items.slice(0, 3);
  }
}
