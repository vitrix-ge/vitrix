import { Component, inject, input, signal } from '@angular/core';
import { Auth } from './auth';
import { Notify } from './notify';
import { TPipe, t } from './content/i18n';

/**
 * "Confirm your email" box for members who haven't clicked the link in the confirmation email yet.
 * Shows nothing for confirmed members or visitors. `reason` says what confirming unlocks.
 */
@Component({
  selector: 'app-confirm-email-notice',
  imports: [TPipe],
  template: `
    @if (auth.user(); as user) {
      @if (!user.emailVerified) {
        <div class="notice confirm-notice" role="status">
          <h2>{{ 'Confirm your email' | t }}</h2>
          <p>
            {{ 'We sent a link to' | t }} <strong>{{ user.email }}</strong
            >. {{ reason() | t }} {{ "Check your spam folder if it isn't in your inbox." | t }}
          </p>
          @if (error()) {
            <p class="error" role="alert">{{ error() | t }}</p>
          }
          <div class="form-actions">
            <button class="btn btn-red" type="button" (click)="resend()" [disabled]="busy()">
              {{ (busy() ? 'Sending…' : sent() ? 'Send again' : 'Resend email') | t }}
            </button>
            <button class="btn btn-ghost" type="button" (click)="check()" [disabled]="busy()">
              {{ "I've confirmed it" | t }}
            </button>
          </div>
        </div>
      }
    }
  `,
})
export class ConfirmEmailNotice {
  protected readonly auth = inject(Auth);
  private readonly notify = inject(Notify);

  readonly reason = input('Click it to confirm that this address is yours.');
  readonly busy = signal(false);
  readonly sent = signal(false);
  readonly error = signal('');

  async resend(): Promise<void> {
    await this.run(async () => {
      await this.auth.resendConfirmation();
      if (this.auth.user()?.emailVerified) {
        this.notify.success(t('Your email is already confirmed.'));
      } else {
        this.sent.set(true);
        this.notify.success(t('Sent. Check {email}.', { email: this.auth.user()?.email ?? '' }));
      }
    });
  }

  /** Confirmed on another device or tab: get a fresh token so the page updates. */
  async check(): Promise<void> {
    await this.run(async () => {
      await this.auth.reloadMember();
      if (this.auth.user()?.emailVerified) {
        this.notify.success(t('Thanks, your email is confirmed.'));
      } else {
        this.error.set(t('Not confirmed yet. Open the link in the email, then try again.'));
      }
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await action();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : t('Something went wrong.'));
    } finally {
      this.busy.set(false);
    }
  }
}
