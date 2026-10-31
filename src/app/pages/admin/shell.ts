import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../../auth';
import { isAdmin } from '../../content/roles';

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <section class="admin">
      <div class="wrap admin-layout">
        <aside class="admin-nav" aria-label="Admin">
          <p class="eyebrow">Admin panel</p>
          <a routerLink="courses" routerLinkActive="is-active">Courses &amp; tests</a>
          <a routerLink="faq" routerLinkActive="is-active">FAQ (public)</a>
          @if (admin()) {
            <a routerLink="students" routerLinkActive="is-active">Students</a>
            <a routerLink="results" routerLinkActive="is-active">Test results</a>
            <a routerLink="team" routerLinkActive="is-active">Team</a>
          }
          <p class="admin-role">
            Signed in as {{ auth.user()?.name }}<br />
            <span class="tag">{{ admin() ? 'Admin' : 'Editor' }}</span>
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
