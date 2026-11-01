import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../../auth';
import { Notify } from '../../notify';
import { TPipe, t } from '../../content/i18n';

/** Opened from the link in the password reset email: /reset-password?user=...&token=... */
@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink, TPipe],
  templateUrl: './reset-password.html',
})
export class ResetPassword {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);

  private readonly userId: string | null;
  private readonly token: string | null;
  readonly linkOk: boolean;
  readonly busy = signal(false);
  readonly failure = signal('');

  readonly form = inject(FormBuilder).nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      repeat: ['', Validators.required],
    },
    { validators: sameValue },
  );

  constructor() {
    const query = inject(ActivatedRoute).snapshot.queryParamMap;
    this.userId = query.get('user');
    this.token = query.get('token');
    this.linkOk = this.auth.enabled && !!this.userId && !!this.token;
  }

  invalid(control: 'password' | 'repeat'): boolean {
    const field = this.form.controls[control];
    return (
      field.touched && (field.invalid || (control === 'repeat' && this.form.hasError('mismatch')))
    );
  }

  async submit(): Promise<void> {
    if (this.form.invalid || !this.userId || !this.token) {
      this.form.markAllAsTouched();
      return;
    }
    const { password } = this.form.getRawValue();
    this.busy.set(true);
    this.failure.set('');
    try {
      const email = await this.auth.resetPassword(this.userId, this.token, password);
      // Sign straight in with the new password.
      try {
        await this.auth.login(email, password);
        this.notify.success(t('Your password has been changed. You are signed in.'));
        await this.router.navigateByUrl('/account');
      } catch {
        this.notify.success(t('Your password has been changed. Log in with the new password.'));
        await this.router.navigateByUrl('/login');
      }
    } catch (error) {
      this.failure.set(error instanceof Error ? error.message : t('Something went wrong.'));
    } finally {
      this.busy.set(false);
    }
  }
}

function sameValue(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const repeat = group.get('repeat')?.value;
  return repeat && password !== repeat ? { mismatch: true } : null;
}
