import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../auth';
import { ConfirmEmailNotice } from '../../confirm-email-notice';
import { Notify } from '../../notify';
import { ContentApi } from '../../content/content.api';
import { CONTENT_ENABLED } from '../../content/content.config';
import { TPipe, TrPipe, t } from '../../content/i18n';
import { MyLearning } from '../../content/my-learning';
import { TwoFactorSettings } from './two-factor-settings';
import { isStaff } from '../../content/roles';

@Component({
  selector: 'app-account',
  imports: [RouterLink, ReactiveFormsModule, TrPipe, TPipe, ConfirmEmailNotice, TwoFactorSettings],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './account.html',
})
export class Account {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly fb = inject(FormBuilder);
  readonly user = this.auth.user;

  private readonly api = inject(ContentApi);
  /** Enrolled courses, for the warning before deleting the account. */
  readonly learning = inject(MyLearning);
  readonly staff = computed(() => isStaff(this.user()));

  /** "Delete account": shown only after the first click, and needs the password. */
  readonly confirmingDelete = signal(false);
  readonly deleting = signal(false);
  readonly deleteError = signal('');
  /** Enrolled members must tick "I understand that I will lose my courses" first. */
  readonly loseCoursesOk = signal(false);
  readonly deleteForm = this.fb.nonNullable.group({
    password: ['', Validators.required],
  });

  logout(): void {
    this.auth.logout();
    this.notify.info(t('You have been logged out.'));
    this.router.navigateByUrl('/');
  }

  startDelete(): void {
    this.confirmingDelete.set(true);
    this.deleteError.set('');
  }

  cancelDelete(): void {
    this.confirmingDelete.set(false);
    this.deleteForm.reset();
    this.loseCoursesOk.set(false);
    this.deleteError.set('');
  }

  async deleteAccount(): Promise<void> {
    if (this.deleteForm.invalid) {
      this.deleteForm.markAllAsTouched();
      return;
    }
    this.deleting.set(true);
    this.deleteError.set('');
    try {
      // Also remove course progress, results and enrollments (vitrix-api) — see the Privacy page.
      const value = this.deleteForm.getRawValue().password;
      // Google-only accounts have no password: they confirm by typing their email.
      const confirmation =
        this.user()?.hasPassword === false ? { email: value } : { password: value };
      await this.auth.deleteAccount(confirmation, () =>
        CONTENT_ENABLED ? this.api.deleteMyData() : Promise.resolve(),
      );
      this.notify.info(t('Your account and personal data have been deleted.'));
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.deleteError.set(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      this.deleting.set(false);
    }
  }
}
