import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Root shell that hosts the current route. */

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  styles: []
})
export class App {}
