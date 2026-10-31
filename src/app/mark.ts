import { Component } from '@angular/core';

let nextMark = 0;

@Component({
  selector: 'app-mark',
  template: `
    <svg viewBox="0 0 100 92" aria-hidden="true">
      <defs>
        <linearGradient [attr.id]="steel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#8b929a" />
          <stop offset="55%" stop-color="#4a5058" />
          <stop offset="100%" stop-color="#2a2f35" />
        </linearGradient>
      </defs>
      <!-- VITRIX mark: graphite stroke + red stroke (as in the brand artwork) -->
      <path [attr.fill]="'url(#' + steel + ')'" d="M2 2h26L62 90H36Z" />
      <path class="accent" d="M98 2H72L55 46h26Z" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }

    svg {
      display: block;
      width: 100%;
      height: auto;
    }

    .accent {
      fill: #e1141e;
    }
  `,
})
export class Mark {
  private readonly id = nextMark++;
  readonly steel = `vitrix-steel-${this.id}`;
}
