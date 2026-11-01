import { NgTemplateOutlet } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Auth } from '../../auth';
import { IDENTITY_URL } from '../../auth.config';
import { Notify } from '../../notify';
import { StaffUser } from '../../content/content.models';
import { TPipe, t } from '../../content/i18n';

/**
 * Admin only: give people the editor (content) or admin role. Roles live on identity-api;
 * a change applies to that person's next sign-in token (within 30 minutes, or right after logging in again).
 */
@Component({
  selector: 'app-admin-team',
  imports: [NgTemplateOutlet, TPipe],
  templateUrl: './team.html',
})
export class AdminTeam {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  private readonly notify = inject(Notify);

  readonly staff = signal<StaffUser[]>([]);
  readonly found = signal<StaffUser[] | null>(null);
  readonly loading = signal(true);
  readonly searching = signal(false);
  readonly error = signal('');
  readonly myId = computed(() => this.auth.user()?.id);

  constructor() {
    void this.loadStaff();
  }

  async loadStaff(): Promise<void> {
    try {
      this.staff.set(await this.get(''));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : t('Could not load the team.'));
    } finally {
      this.loading.set(false);
    }
  }

  async search(term: string): Promise<void> {
    if (term.trim().length < 2) {
      this.notify.info(t('Type at least 2 characters of the email.'));
      return;
    }
    this.searching.set(true);
    try {
      this.found.set(await this.get(term.trim()));
    } catch (e) {
      this.notify.error(e instanceof Error ? e.message : t('Search failed.'));
    } finally {
      this.searching.set(false);
    }
  }

  has(user: StaffUser, role: string): boolean {
    return user.roles.includes(role);
  }

  async toggle(user: StaffUser, role: 'admin' | 'editor'): Promise<void> {
    const roles = this.has(user, role)
      ? user.roles.filter((r) => r !== role)
      : [...user.roles, role];
    if (
      role === 'admin' &&
      !this.has(user, 'admin') &&
      !confirm(
        t('Make {email} an admin? Admins can manage students, results and the team.', {
          email: user.email,
        }),
      )
    ) {
      return;
    }
    try {
      const saved = await firstValueFrom(
        this.http.put<StaffUser>(
          `${IDENTITY_URL}/api/admin/users/${user.id}/roles`,
          { roles },
          { headers: this.headers() },
        ),
      );
      const replace = (list: StaffUser[]) => list.map((u) => (u.id === saved.id ? saved : u));
      this.found.update((list) => (list ? replace(list) : list));
      this.staff.update((list) =>
        list.some((u) => u.id === saved.id)
          ? replace(list).filter((u) => u.roles.length > 0)
          : saved.roles.length
            ? [...list, saved]
            : list,
      );
      this.notify.success(
        t('{email}: {roles}. Applies at their next login.', {
          email: saved.email,
          roles: saved.roles.length ? saved.roles.map((r) => t(r)).join(', ') : t('no staff role'),
        }),
      );
    } catch (e) {
      this.notify.error(describe(e));
    }
  }

  private get(search: string): Promise<StaffUser[]> {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return firstValueFrom(
      this.http.get<StaffUser[]>(`${IDENTITY_URL}/api/admin/users${q}`, {
        headers: this.headers(),
      }),
    ).catch((e) => {
      throw new Error(describe(e));
    });
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.accessToken() ?? ''}` });
  }
}

function describe(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    const errors = (e.error as { errors?: string[] } | null)?.errors;
    if (Array.isArray(errors)) return errors.map((x) => t(x)).join(' ');
    if (e.status === 0) return t('The account server is not reachable.');
    if (e.status === 403 || e.status === 401)
      return t('Only admins can change roles. Log in again if you were just made admin.');
  }
  return e instanceof Error ? e.message : t('Something went wrong.');
}
