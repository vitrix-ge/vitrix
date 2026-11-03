import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../auth';
import { ConfirmEmailNotice } from '../../confirm-email-notice';
import { Notify } from '../../notify';
import { ContentApi } from '../../content/content.api';
import { CONTENT_ENABLED } from '../../content/content.config';
import { AttemptRow, Certificate, MyApplication, MyCourse } from '../../content/content.models';
import { TPipe, TrPipe, t } from '../../content/i18n';
import { isStaff } from '../../content/roles';

/** What applicants see for each status (admins see the same words in the Applications page). */
export const STATUS_LABELS: Record<string, string> = {
  new: 'Received',
  contacted: 'In review',
  accepted: 'Accepted',
  rejected: 'Not accepted',
};

@Component({
  selector: 'app-account',
  imports: [RouterLink, ReactiveFormsModule, TrPipe, TPipe, DatePipe, ConfirmEmailNotice],
  templateUrl: './account.html',
})
export class Account {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly fb = inject(FormBuilder);
  readonly user = this.auth.user;

  private readonly api = inject(ContentApi);
  readonly contentEnabled = CONTENT_ENABLED;
  readonly staff = computed(() => isStaff(this.user()));
  readonly myCourses = signal<MyCourse[]>([]);
  readonly results = signal<AttemptRow[]>([]);
  readonly loadingCourses = signal(CONTENT_ENABLED);
  readonly applications = signal<MyApplication[]>([]);
  readonly certificates = signal<Certificate[]>([]);
  /** "Continue where you left off": the started course with the most progress, else the first. */
  readonly resume = computed(() => {
    const open = this.myCourses().filter((c) => c.nextLessonId);
    if (!open.length) {
      return null;
    }
    return [...open].sort((a, b) => this.percent(b) - this.percent(a))[0];
  });

  constructor() {
    // Load courses now, and again once the email gets confirmed (they need a confirmed email).
    let verified: boolean | undefined;
    effect(() => {
      const now = this.user()?.emailVerified;
      if (now !== verified) {
        verified = now;
        untracked(() => this.loadCourses());
      }
    });
  }

  private loadCourses(): void {
    if (CONTENT_ENABLED && this.user()) {
      this.loadingCourses.set(true);
      Promise.all([
        this.api.myCourses(),
        this.api.myAttempts(),
        this.api.myApplications().catch(() => []),
        this.api.myCertificates().catch(() => []),
      ])
        .then(([courses, results, applications, certificates]) => {
          this.myCourses.set(courses);
          this.results.set(results);
          this.applications.set(applications);
          this.certificates.set(certificates);
        })
        .catch(() => undefined) // course server unreachable: show the empty state
        .finally(() => this.loadingCourses.set(false));
    }
  }

  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  percent(c: MyCourse): number {
    return c.lessonsTotal ? Math.round((100 * c.lessonsCompleted) / c.lessonsTotal) : 0;
  }

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
