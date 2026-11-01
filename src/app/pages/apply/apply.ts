import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Catalog } from '../../content/catalog';
import { TPipe, TrPipe } from '../../content/i18n';
import { Auth } from '../../auth';
import { ConfirmEmailNotice } from '../../confirm-email-notice';

@Component({
  selector: 'app-apply',
  imports: [ReactiveFormsModule, TrPipe, ConfirmEmailNotice, TPipe],
  templateUrl: './apply.html',
})
export class Apply {
  private readonly fb = inject(FormBuilder);
  private readonly catalog = inject(Catalog);
  readonly courses = this.catalog.courses;
  readonly sent = signal(false);
  private readonly auth = inject(Auth);
  /** Signed in with an email that isn't confirmed yet: confirm first, then apply. */
  readonly needsConfirmation = computed(() => {
    const user = this.auth.user();
    return !!user && !user.emailVerified;
  });

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    course: ['', Validators.required],
    background: ['', Validators.required],
  });

  constructor() {
    void this.catalog.load();
    // Signed in: start from the account's details (they can still be edited).
    const user = this.auth.user();
    if (user) {
      this.form.patchValue({
        email: user.email,
        // Only a real display name; not the fallback made from the email address.
        name: user.name === user.email.split('@')[0] ? '' : user.name,
      });
    }
  }

  invalid(control: 'name' | 'email' | 'course' | 'background'): boolean {
    const field = this.form.controls[control];
    return field.invalid && field.touched;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.sent.set(true);
  }
}
