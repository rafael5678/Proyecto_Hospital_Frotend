import { Injectable, Injector, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthResponse, LoginRequest, SessionUser } from '../models/auth.model';
import { RegisterRequest } from '../models/paciente-perfil.model';
import { InactivityService } from './inactivity.service';

const SESSION_KEY = 'hospy_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = `${environment.apiUrl}/auth`;
  private readonly injector = inject(Injector);
  readonly user = signal<SessionUser | null>(this.loadSession());

  constructor(private http: HttpClient, private router: Router) {}

  register(data: RegisterRequest) {
    return this.http.post<{ mensaje: string }>(`${this.api}/register`, data);
  }

  login(data: LoginRequest) {
    return this.http.post<AuthResponse>(`${this.api}/login`, data).pipe(
      tap(res => this.saveSession(res))
    );
  }

  logout() {
    this.stopInactivityMonitor();
    localStorage.removeItem(SESSION_KEY);
    this.user.set(null);
    this.router.navigate(['/']);
  }

  logoutPorInactividad(rol: 'ADMIN' | 'MEDICO') {
    this.stopInactivityMonitor();
    localStorage.removeItem(SESSION_KEY);
    this.user.set(null);
    const loginPath = rol === 'ADMIN' ? '/admin/login' : '/medico/login';
    this.router.navigate([loginPath], { queryParams: { sesionExpirada: '1' } });
  }

  get token(): string | null {
    return this.user()?.token ?? null;
  }

  isLoggedIn(): boolean {
    return !!this.token;
  }

  hasRole(rol: string): boolean {
    return this.user()?.rol === rol;
  }

  redirectByRole() {
    const rol = this.user()?.rol;
    if (rol === 'PACIENTE') this.router.navigate(['/paciente']);
    else if (rol === 'MEDICO') this.router.navigate(['/medico']);
    else if (rol === 'ADMIN') this.router.navigate(['/admin']);
  }

  private stopInactivityMonitor(): void {
    try {
      this.injector.get(InactivityService).stop();
    } catch {
      /* monitor no iniciado */
    }
  }

  private saveSession(res: AuthResponse) {
    const session: SessionUser = {
      token: res.token,
      id: res.id,
      nombre: res.nombre,
      email: res.email,
      rol: res.rol
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    this.user.set(session);
  }

  private loadSession(): SessionUser | null {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionUser;
    } catch {
      return null;
    }
  }
}
