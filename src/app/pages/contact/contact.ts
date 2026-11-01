import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ContentApi } from '../../content/content.api';
import { CONTENT_ENABLED } from '../../content/content.config';
import { TPipe } from '../../content/i18n';
import { PRIVACY_CONTACT_EMAIL } from '../../site-data';

/** Contact form → POST /api/contact (saved for admin → Applications → Messages, emailed to the team). */
@Component({
  selector: 'app-contact',
  imports: [ReactiveFormsModule, TPipe],
  templateUrl: './contact.html',
})
export class Contact {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ContentApi);
  readonly sent = signal(false);
  readonly sending = signal(false);
  readonly error = signal('');
  readonly email = PRIVACY_CONTACT_EMAIL;

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    organization: [''],
    message: ['', [Validators.required, Validators.minLength(12)]],
    // Honeypot: hidden from people, filled by bots (the server then quietly drops the message).
    website: [''],
  });

  invalid(control: 'name' | 'email' | 'message'): boolean {
    const field = this.form.controls[control];
    return field.invalid && field.touched;
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (!CONTENT_ENABLED) {
      this.error.set('The course server is not reachable. Please try again later.');
      return;
    }
    const v = this.form.getRawValue();
    this.sending.set(true);
    this.error.set('');
    try {
      await this.api.contact({
        name: v.name.trim(),
        email: v.email.trim(),
        organization: v.organization.trim(),
        message: v.message.trim(),
        website: v.website,
      });
      this.sent.set(true);
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.sending.set(false);
    }
  }
}
