import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TPipe } from '../../content/i18n';

/** Any address the site doesn't have. GitHub Pages also answers it with HTTP 404 (404.html). */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink, TPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="page-hero not-found">
      <div class="wrap">
        <p class="eyebrow">404</p>
        <h1>{{ 'Page not found' | t }}</h1>
        <p class="lede">
          {{
            'This address does not exist on the VITRIX website. It may have moved or been mistyped.'
              | t
          }}
        </p>
        <div class="form-actions">
          <a class="btn btn-red" routerLink="/">{{ 'Go to the home page' | t }}</a>
          <a class="btn btn-ghost" routerLink="/courses">{{ 'Browse courses' | t }}</a>
        </div>
      </div>
    </section>
  `,
})
export class NotFound {}
