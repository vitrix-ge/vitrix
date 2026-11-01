import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TPipe } from '../../content/i18n';

@Component({
  selector: 'app-simulation',
  imports: [RouterLink, TPipe],
  templateUrl: './simulation.html',
})
export class Simulation {}
