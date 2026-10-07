import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  template: '',
})
export class LoginComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  ngOnInit() {
    const queryParams = { ...this.route.snapshot.queryParams };
    if (queryParams['sesionExpirada'] === '1') {
      queryParams['sessionExpired'] = '1';
      delete queryParams['sesionExpirada'];
    }
    if (queryParams['registrado'] === '1') {
      queryParams['registered'] = '1';
      delete queryParams['registrado'];
    }
    this.router.navigate(['/'], { queryParams, replaceUrl: true });
  }
}
