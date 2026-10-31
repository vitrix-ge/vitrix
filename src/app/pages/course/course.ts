import { ConfirmEmailNotice } from '../../confirm-email-notice';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Auth } from '../../auth';
import { Notify } from '../../notify';
import { Catalog } from '../../content/catalog';
import { ContentApi } from '../../content/content.api';
import { CONTENT_ENABLED } from '../../content/content.config';
import { AttemptResult, CourseDetail, Lesson } from '../../content/content.models';
import { QuizRunner } from '../quiz/quiz-runner';
import { TrPipe } from '../../content/i18n';
import { youtubeEmbedUrl } from '../../content/youtube';

/**
 * /courses/:slug — overview for everyone; lessons (with video), progress and tests for enrolled
 * members and staff. Falls back to the built-in course text when the course server isn't available.
 */
@Component({
  selector: 'app-course',
  imports: [RouterLink, TrPipe, ConfirmEmailNotice, QuizRunner],
  templateUrl: './course.html',
})
export class CoursePage {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ContentApi);
  private readonly catalog = inject(Catalog);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly notify = inject(Notify);
  readonly auth = inject(Auth);

  readonly detail = signal<CourseDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly openLessonId = signal<string | null>(null);
  readonly slug = signal('');

  /** Built-in text while the server is unreachable. */
  readonly fallback = computed(() => this.catalog.courses().find((c) => c.slug === this.slug()));
  readonly course = computed(() => this.detail()?.course ?? this.fallback() ?? null);
  readonly completedCount = computed(
    () => this.detail()?.lessons.filter((lesson) => lesson.completed).length ?? 0,
  );

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.slug.set(params.get('slug') ?? '');
      void this.load();
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    if (!CONTENT_ENABLED) {
      this.loading.set(false);
      return;
    }
    // Wait for a saved login to be restored, so enrolled members get the full course.
    await firstValueFrom(this.auth.ready$);
    try {
      const detail = await this.api.course(this.slug());
      this.detail.set(detail);
      const firstOpen =
        detail.lessons.find((l) => !l.completed && !l.locked) ??
        detail.lessons.find((l) => !l.locked);
      if (detail.enrolled && firstOpen && !this.openLessonId()) {
        this.openLessonId.set(firstOpen.id);
      }
    } catch (e) {
      if (!this.fallback()) {
        this.error.set(e instanceof Error ? e.message : 'Course not found.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  toggle(lesson: Lesson): void {
    this.openLessonId.set(this.openLessonId() === lesson.id ? null : lesson.id);
  }

  videoUrl(lesson: Lesson): SafeResourceUrl | null {
    // youtubeId is validated as exactly 11 safe characters by the API and the admin form.
    return lesson.youtubeId && /^[A-Za-z0-9_-]{11}$/.test(lesson.youtubeId)
      ? this.sanitizer.bypassSecurityTrustResourceUrl(youtubeEmbedUrl(lesson.youtubeId))
      : null;
  }

  async complete(lesson: Lesson): Promise<void> {
    try {
      await this.api.completeLesson(lesson.id);
      await this.lessonDone();
    } catch (e) {
      this.notify.error(e instanceof Error ? e.message : 'Could not save your progress.');
    }
  }

  /** The inline lesson quiz was submitted; passing it completed the lesson on the server. */
  async quizFinished(_lesson: Lesson, result: AttemptResult): Promise<void> {
    if (result.passed) {
      // Leave the result on screen for a moment, then move on.
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await this.lessonDone();
    }
  }

  /** Reload (the next lesson unlocks and its video is sent), then open it. */
  private async lessonDone(): Promise<void> {
    this.openLessonId.set(null);
    await this.load();
    const lessons = this.detail()?.lessons ?? [];
    const next = lessons.find((l) => !l.completed && !l.locked);
    this.openLessonId.set(next?.id ?? null);
    const exam = this.detail()?.quizzes.find((q) => !q.passed);
    this.notify.success(
      next
        ? 'Lesson completed. On to the next one.'
        : exam
          ? 'All lessons completed! The final exam is open.'
          : 'All lessons completed!',
    );
  }
}
