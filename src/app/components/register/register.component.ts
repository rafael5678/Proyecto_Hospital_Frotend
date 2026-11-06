import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { CLAVE_MAX, CLAVE_MIN, mensajeTelefono, soloDigitos, telefonoColombiano } from '../../data/datos-persona';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  nombre = '';
  email = '';
  password = '';
  confirmPassword = '';
  telefono = '';
  documento = '';
  fechaNacimiento = '';
  genero = '';
  tipoSangre = '';
  direccion = '';
  ciudad = '';
  alergias = '';
  contactoEmergencia = '';
  telefonoEmergencia = '';
  observaciones = '';
  readonly soloDigitos = soloDigitos;
  error = signal('');
  loading = signal(false);
  wakingServer = signal(false);

  ngOnInit() {
    if (environment.production) {
      this.wakingServer.set(true);
      fetch(`${environment.apiUrl}/health`)
        .catch(() => {})
        .finally(() => this.wakingServer.set(false));
    }
  }

  onSubmit() {
    this.telefono = soloDigitos(this.telefono);
    this.telefonoEmergencia = soloDigitos(this.telefonoEmergencia);
    if (this.password.length < CLAVE_MIN || this.password.length > CLAVE_MAX) {
      this.error.set(`La contraseña debe tener entre ${CLAVE_MIN} y ${CLAVE_MAX} caracteres.`);
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error.set('Las contraseñas no coinciden');
      return;
    }
    if (!telefonoColombiano(this.telefono)) {
      this.error.set(mensajeTelefono('El teléfono'));
      return;
    }
    if (!telefonoColombiano(this.telefonoEmergencia)) {
      this.error.set(mensajeTelefono('El teléfono de emergencia'));
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.auth.register({
      nombre: this.nombre,
      email: this.email,
      password: this.password,
      telefono: this.telefono,
      documento: this.documento,
      fechaNacimiento: this.fechaNacimiento || undefined,
      genero: this.genero || undefined,
      tipoSangre: this.tipoSangre || undefined,
      direccion: this.direccion || undefined,
      ciudad: this.ciudad || undefined,
      alergias: this.alergias || undefined,
      contactoEmergencia: this.contactoEmergencia || undefined,
      telefonoEmergencia: this.telefonoEmergencia || undefined,
      observaciones: this.observaciones || undefined
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/'], {
          queryParams: { registered: '1' }
        });
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(e.error?.error ?? 'Error al registrarse');
      }
    });
  }
}
