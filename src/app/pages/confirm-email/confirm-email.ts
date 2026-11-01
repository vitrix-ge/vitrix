import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Auth } from '../../auth';
import { ConfirmEmailNotice } from '../../confirm-email-notice';
import { TPipe, t } from '../../content/i18n';

/** Opened from the link in the confirmation email: /confirm-email?user=...&token=... */
@Component({
  selector: 'app-confirm-email',
  imports: [RouterLink, ConfirmEmailNotice, TPipe],
  templateUrl: './confirm-email.html',
})
export class ConfirmEmail {
  readonly auth = inject(Auth);
  readonly state = signal<'working' | 'done' | 'failed'>('working');
  readonly email = signal('');
  readonly error = signal('');

  constructor() {
    const query = inject(ActivatedRoute).snapshot.queryParamMap;
    const user = query.get('user');
    const token = query.get('token');
    if (!this.auth.enabled || !user || !token) {
      this.fail(t('This link is incomplete. Open it again from the email, or ask for a new one.'));
      return;
    }
    // Wait for a saved session first, so a signed-in member's token is refreshed afterwards.
    this.auth.ready$.subscribe(() => {
      this.auth
        .confirmEmail(user, token)
        .then((email) => {
          this.email.set(email);
          this.state.set('done');
        })
        .catch((e: unknown) =>
          this.fail(e instanceof Error ? e.message : t('Something went wrong.')),
        );
    });
  }

  private fail(message: string): void {
    this.error.set(message);
    this.state.set('failed');
  }
}
