import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { ID_MAX, PASSWORD_MAX, PASSWORD_MIN, blockSpace, phoneMessage, idDigitsOnly, digitsOnly, isColombianPhone, withoutSpaces } from '../../data/person-data';

/** Public patient sign-up form. */
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
  readonly digitsOnly = digitsOnly;
  readonly idDigitsOnly = idDigitsOnly;
  readonly withoutSpaces = withoutSpaces;
  readonly blockSpace = blockSpace;
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
    this.telefono = digitsOnly(this.telefono);
    this.telefonoEmergencia = digitsOnly(this.telefonoEmergencia);
    if (this.password.length < PASSWORD_MIN || this.password.length > PASSWORD_MAX) {
      this.error.set(`La contraseña debe tener entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres.`);
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error.set('Las contraseñas no coinciden');
      return;
    }
    if (!isColombianPhone(this.telefono)) {
      this.error.set(phoneMessage('El teléfono'));
      return;
    }
    if (!isColombianPhone(this.telefonoEmergencia)) {
      this.error.set(phoneMessage('El teléfono de emergencia'));
      return;
    }
    this.documento = idDigitsOnly(this.documento);
    if (!this.documento) {
      this.error.set(`La cédula solo lleva números, máximo ${ID_MAX}.`);
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
