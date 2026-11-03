import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../../auth';
import { ConfirmEmailNotice } from '../../confirm-email-notice';
import { ContentApi } from '../../content/content.api';
import { CONTENT_ENABLED } from '../../content/content.config';
import { AttemptRow, Certificate, MyCourse } from '../../content/content.models';
import { TPipe, TrPipe } from '../../content/i18n';
import { MyLearning } from '../../content/my-learning';
import { Loading } from '../../loading';

/** What applicants see for each status (admins see the same words in the Applications page). */
export const STATUS_LABELS: Record<string, string> = {
  new: 'Received',
  contacted: 'In review',
  accepted: 'Accepted',
  rejected: 'Not accepted',
};

/**
 * /my-courses — the member's learning dashboard: continue where you left off, enrolled courses with
 * progress, certificates, applications still waiting for an answer, and test results.
 * Reached from the header's account menu; members land here after logging in.
 */
@Component({
  selector: 'app-my-courses',
  imports: [Loading, RouterLink, TrPipe, TPipe, DatePipe, ConfirmEmailNotice],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './my-courses.html',
})
export class MyCourses {
  private readonly auth = inject(Auth);
  private readonly api = inject(ContentApi);
  readonly learning = inject(MyLearning);
  readonly user = this.auth.user;

  readonly results = signal<AttemptRow[]>([]);
  readonly certificates = signal<Certificate[]>([]);
  readonly loading = computed(() => CONTENT_ENABLED && this.learning.loading());

  /** Applications still worth showing: once the course is in "My courses", its application is done. */
  readonly openApplications = computed(() =>
    this.learning.applications().filter((a) => !this.learning.enrolledIn(a.courseCode)),
  );
  /** "Continue where you left off": the started course with the most progress, else the first. */
  readonly resume = computed(() => {
    const open = this.learning.courses().filter((c) => c.nextLessonId);
    if (!open.length) {
      return null;
    }
    return [...open].sort((a, b) => this.percent(b) - this.percent(a))[0];
  });

  constructor() {
    // Fresh data on every visit (progress changes while studying), and again once the email is confirmed.
    let verified: boolean | undefined;
    effect(() => {
      const now = this.user()?.emailVerified;
      if (now !== verified) {
        verified = now;
        untracked(() => this.load());
      }
    });
  }

  private load(): void {
    if (!CONTENT_ENABLED || !this.user()) {
      return;
    }
    void this.learning.load(true);
    this.api.myAttempts().then(
      (r) => this.results.set(r),
      () => undefined,
    );
    this.api.myCertificates().then(
      (c) => this.certificates.set(c),
      () => undefined,
    );
  }

  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  percent(c: MyCourse): number {
    return c.lessonsTotal ? Math.round((100 * c.lessonsCompleted) / c.lessonsTotal) : 0;
  }
}
