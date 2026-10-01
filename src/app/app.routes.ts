import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';
import { LandingComponent } from './components/landing/landing.component';
import { LoginComponent } from './components/login/login.component';
import { RegistroComponent } from './components/registro/registro.component';
import { PacientePortalComponent } from './components/paciente-portal/paciente-portal.component';
import { MedicoPortalComponent } from './components/medico-portal/medico-portal.component';
import { AdminPortalComponent } from './components/admin-portal/admin-portal.component';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'paciente/login', component: LoginComponent },
  { path: 'medico/login', component: LoginComponent },
  { path: 'admin/login', component: LoginComponent },
  { path: 'paciente/registro', component: RegistroComponent },
  {
    path: 'paciente',
    component: PacientePortalComponent,
    canActivate: [authGuard, roleGuard('PACIENTE')]
  },
  {
    path: 'medico',
    component: MedicoPortalComponent,
    canActivate: [authGuard, roleGuard('MEDICO')]
  },
  {
    path: 'admin',
    component: AdminPortalComponent,
    canActivate: [authGuard, roleGuard('ADMIN')]
  },
  { path: '**', redirectTo: '' }
];
