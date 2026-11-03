import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Catalog } from '../../content/catalog';
import { ContentApi } from '../../content/content.api';
import { CONTENT_ENABLED } from '../../content/content.config';
import { TPipe, TrPipe } from '../../content/i18n';
import { Auth } from '../../auth';
import { ConfirmEmailNotice } from '../../confirm-email-notice';

/**
 * Apply form → POST /api/applications. The team gets an email and sees it in admin → Applications;
 * the applicant sees its status in My account. The reply goes to the account's email address.
 */
@Component({
  selector: 'app-apply',
  imports: [ReactiveFormsModule, RouterLink, TrPipe, ConfirmEmailNotice, TPipe],
  templateUrl: './apply.html',
})
export class Apply {
  private readonly fb = inject(FormBuilder);
  private readonly catalog = inject(Catalog);
  private readonly api = inject(ContentApi);
  private readonly auth = inject(Auth);

  readonly courses = this.catalog.courses;
  /** Applications are saved by the course server; without it the form can't be sent. */
  readonly serverReady = computed(() => this.catalog.source() === 'api');
  readonly loading = signal(CONTENT_ENABLED);
  readonly sending = signal(false);
  readonly error = signal('');
  readonly sent = signal(false);
  readonly email = computed(() => this.auth.user()?.email ?? '');
  /** Signed in with an email that isn't confirmed yet: confirm first, then apply. */
  readonly needsConfirmation = computed(() => {
    const user = this.auth.user();
    return !!user && !user.emailVerified;
  });

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    phone: [''],
    course: ['', Validators.required],
    background: ['', Validators.required],
  });

  /** The chosen course, for the thank-you message. */
  readonly chosen = signal('');

  constructor() {
    const user = this.auth.user();
    if (user) {
      // Only a real display name; not the fallback made from the email address.
      this.form.patchValue({ name: user.name === user.email.split('@')[0] ? '' : user.name });
    }
    // /apply?course=acls (from a course page) picks that course.
    const wanted = inject(ActivatedRoute).snapshot.queryParamMap.get('course');
    void this.catalog.load().then(() => {
      this.loading.set(false);
      const match = this.courses().find((c) => c.slug === wanted || c.id === wanted);
      if (match && this.serverReady()) {
        this.form.controls.course.setValue(match.id);
      }
    });
  }

  invalid(control: 'name' | 'course' | 'background'): boolean {
    const field = this.form.controls[control];
    return field.invalid && field.touched;
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.sending.set(true);
    this.error.set('');
    try {
      const saved = await this.api.apply({
        courseId: value.course,
        name: value.name.trim(),
        phone: value.phone.trim(),
        background: value.background.trim(),
      });
      this.chosen.set(saved.courseCode);
      this.sent.set(true);
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.sending.set(false);
    }
  }
}
