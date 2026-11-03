import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Auth } from '../auth';
import { ContentApi } from './content.api';
import { CONTENT_ENABLED } from './content.config';
import { MyApplication, MyCourse } from './content.models';

/**
 * The signed-in member's courses and applications, shared by the header, My courses, the course
 * list, the course page and Apply (so nobody applies again for a course they already have).
 * Loads when a member signs in or confirms their email; empty for visitors.
 */
@Injectable({ providedIn: 'root' })
export class MyLearning {
  private readonly api = inject(ContentApi);
  private readonly auth = inject(Auth);

  readonly courses = signal<MyCourse[]>([]);
  readonly applications = signal<MyApplication[]>([]);
  /** true until the first load for the current member has finished. */
  readonly loading = signal(false);
  private loaded: Promise<void> | null = null;

  /** Course codes the member is enrolled in. */
  readonly enrolledCodes = computed(() => new Set(this.courses().map((c) => c.course.code)));
  /** Course codes with an application still waiting for an answer. */
  readonly pendingCodes = computed(
    () =>
      new Set(
        this.applications()
          .filter(
            (a) =>
              (a.status === 'new' || a.status === 'contacted') &&
              !this.enrolledCodes().has(a.courseCode),
          )
          .map((a) => a.courseCode),
      ),
  );

  constructor() {
    // Reload whenever the member (or their email confirmation) changes.
    let key: string | undefined;
    effect(() => {
      const user = this.auth.user();
      const now = user ? `${user.id}:${user.emailVerified}` : '';
      if (now !== key) {
        key = now;
        untracked(() => {
          this.courses.set([]);
          this.applications.set([]);
          this.loaded = null;
          if (user) {
            void this.load();
          }
        });
      }
    });
  }

  /** Loads once per member; pass `force` after something changed (e.g. a new application). */
  load(force = false): Promise<void> {
    if (!CONTENT_ENABLED || !this.auth.user()) {
      return Promise.resolve();
    }
    if (this.loaded && !force) {
      return this.loaded;
    }
    this.loading.set(true);
    this.loaded = Promise.all([
      this.api.myCourses().catch(() => [] as MyCourse[]),
      this.api.myApplications().catch(() => [] as MyApplication[]),
    ])
      .then(([courses, applications]) => {
        this.courses.set(courses);
        this.applications.set(applications);
      })
      .finally(() => this.loading.set(false));
    return this.loaded;
  }

  enrolledIn(code: string | undefined): boolean {
    return !!code && this.enrolledCodes().has(code);
  }

  appliedFor(code: string | undefined): boolean {
    return !!code && this.pendingCodes().has(code);
  }
}
