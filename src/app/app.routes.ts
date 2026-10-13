import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';
import { LandingComponent } from './components/landing/landing.component';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { PatientPortalComponent } from './components/patient-portal/patient-portal.component';
import { DoctorPortalComponent } from './components/doctor-portal/doctor-portal.component';
import { AdminPortalComponent } from './components/admin-portal/admin-portal.component';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'login', component: LandingComponent },
  { path: 'registro', component: RegisterComponent },
  { path: 'paciente/login', component: LoginComponent },
  { path: 'medico/login', component: LoginComponent },
  { path: 'admin/login', component: LoginComponent },
  { path: 'paciente/registro', redirectTo: 'registro', pathMatch: 'full' },
  {
    path: 'paciente',
    component: PatientPortalComponent,
    canActivate: [authGuard, roleGuard('PACIENTE')]
  },
  {
    path: 'medico',
    component: DoctorPortalComponent,
    canActivate: [authGuard, roleGuard('MEDICO')]
  },
  {
    path: 'admin',
    component: AdminPortalComponent,
    canActivate: [authGuard, roleGuard('ADMIN')]
  },
  { path: '**', redirectTo: '' }
];
