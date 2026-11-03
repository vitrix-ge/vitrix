import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../../auth';
import { isAdmin } from '../../content/roles';
import { TPipe } from '../../content/i18n';

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="admin">
      <div class="wrap admin-layout">
        <aside class="admin-nav" [attr.aria-label]="'Admin' | t">
          <p class="eyebrow">{{ 'Admin panel' | t }}</p>
          <a routerLink="courses" routerLinkActive="is-active">{{ 'Courses & tests' | t }}</a>
          <a routerLink="faq" routerLinkActive="is-active">{{ 'FAQ (public)' | t }}</a>
          @if (admin()) {
            <a routerLink="applications" routerLinkActive="is-active">{{ 'Applications' | t }}</a>
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
          @if (auth.user()?.twoFactor === false) {
            <div class="notice two-factor-nudge" role="status">
              <p>
                <strong>{{ 'Protect your staff account.' | t }}</strong>
                {{
                  'Turn on two-step login, so a stolen password alone cannot open the admin panel.'
                    | t
                }}
              </p>
              <a class="btn btn-red btn-sm" routerLink="/account" fragment="two-factor">{{
                'Turn on' | t
              }}</a>
            </div>
          }
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
