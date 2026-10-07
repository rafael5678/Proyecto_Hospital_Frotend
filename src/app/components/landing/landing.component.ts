import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { timeout } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

const REMEMBERED_EMAIL_KEY = 'hospy_remembered_email';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent implements OnInit {
  readonly environment = environment;
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  email = '';
  password = '';
  rememberMe = false;
  showPassword = false;
  errorMessage = signal('');
  successMessage = signal('');
  loading = signal(false);
  wakingServer = signal(false);

  ngOnInit() {
    if (this.auth.isLoggedIn()) {
      this.auth.redirectByRole();
      return;
    }

    const savedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (savedEmail) {
      this.email = savedEmail;
      this.rememberMe = true;
    }

    if (environment.production) {
      this.wakingServer.set(true);
      fetch(`${environment.apiUrl}/health`)
        .catch(() => {})
        .finally(() => this.wakingServer.set(false));
    }

    if (this.route.snapshot.queryParamMap.get('registered') === '1'
      || this.route.snapshot.queryParamMap.get('registrado') === '1') {
      this.successMessage.set('Registro exitoso. Inicia sesión con tu correo y contraseña.');
    }
    if (this.route.snapshot.queryParamMap.get('sessionExpired') === '1'
      || this.route.snapshot.queryParamMap.get('sesionExpirada') === '1') {
      this.errorMessage.set('Sesión cerrada por inactividad.');
    }
  }

  onSubmit() {
    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    if (this.rememberMe) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, this.email.trim());
    } else {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }

    this.auth.login({ email: this.email.trim(), password: this.password }).pipe(
      timeout(120000)
    ).subscribe({
      next: () => {
        this.loading.set(false);
        this.auth.redirectByRole();
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(this.mapLoginError(err));
      }
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  private mapLoginError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const apiMessage = this.extractApiMessage(error.error);
      if (apiMessage) return apiMessage;
      if (error.status === 0) {
        return 'No se pudo conectar con el servidor. Espera un minuto e inténtalo de nuevo.';
      }
      if (error.status === 400) return 'Correo o contraseña incorrectos.';
    }
    const timeoutError = error as { name?: string; message?: string };
    if (timeoutError?.name === 'TimeoutError' || timeoutError?.message?.includes('Timeout')) {
      return 'El servidor tardó demasiado. Recarga e inténtalo de nuevo.';
    }
    return 'No se pudo iniciar sesión. Verifica correo y contraseña.';
  }

  private extractApiMessage(body: unknown): string | null {
    if (body && typeof body === 'object' && 'error' in body) {
      const message = (body as { error: unknown }).error;
      if (typeof message === 'string' && message.trim()) return message;
    }
    return null;
  }
}
