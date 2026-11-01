import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../../auth';
import { isAdmin } from '../../content/roles';
import { TPipe } from '../../content/i18n';

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TPipe],
  template: `
    <section class="admin">
      <div class="wrap admin-layout">
        <aside class="admin-nav" [attr.aria-label]="'Admin' | t">
          <p class="eyebrow">{{ 'Admin panel' | t }}</p>
          <a routerLink="courses" routerLinkActive="is-active">{{ 'Courses & tests' | t }}</a>
          <a routerLink="faq" routerLinkActive="is-active">{{ 'FAQ (public)' | t }}</a>
          @if (admin()) {
            <a routerLink="students" routerLinkActive="is-active">{{ 'Students' | t }}</a>
            <a routerLink="results" routerLinkActive="is-active">{{ 'Test results' | t }}</a>
            <a routerLink="team" routerLinkActive="is-active">{{ 'Team' | t }}</a>
          }
          <p class="admin-role">
            {{ 'Signed in as' | t }} {{ auth.user()?.name }}<br />
            <span class="tag">{{ (admin() ? 'Admin' : 'Editor') | t }}</span>
          </p>
        </aside>
        <div class="admin-main">
          <router-outlet />
        </div>
      </div>
    </section>
  `,
})
export class AdminShell {
  readonly auth = inject(Auth);
  readonly admin = computed(() => isAdmin(this.auth.user()));
}
