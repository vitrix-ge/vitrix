import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Notify } from '../../notify';
import { Catalog } from '../../content/catalog';
import { ContentApi } from '../../content/content.api';
import { Course, Lesson, Quiz } from '../../content/content.models';
import { TPipe, TrPipe, t } from '../../content/i18n';
import { youtubeId } from '../../content/youtube';
import { ltextGroup, move, slugify } from './forms';
import { LTextField } from './ltext-field';

/** Accepts an 11-character id or any YouTube link; empty is allowed (lesson without video). */
function youtubeValidator(control: { value: string }) {
  return !control.value || youtubeId(control.value) ? null : { youtube: true };
}

@Component({
  selector: 'app-admin-course-edit',
  imports: [ReactiveFormsModule, RouterLink, TrPipe, LTextField, NgTemplateOutlet, TPipe],
  templateUrl: './course-edit.html',
})
export class AdminCourseEdit {
  private readonly api = inject(ContentApi);
  private readonly notify = inject(Notify);
  private readonly router = inject(Router);
  private readonly catalog = inject(Catalog);
  private readonly fb = inject(FormBuilder);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  readonly course = signal<Course | null>(null);
  readonly lessons = signal<Lesson[]>([]);
  readonly quizzes = signal<Quiz[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(30)]],
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9]+(-[a-z0-9]+)*$/)]],
    title: ltextGroup(this.fb, null, true),
    summary: ltextGroup(this.fb),
    description: ltextGroup(this.fb),
    format: ltextGroup(this.fb),
    duration: ltextGroup(this.fb),
    outcomes: ltextGroup(this.fb),
    /** yyyy-MM-dd from <input type="date">; '' = on request. */
    nextStart: [''],
    imageUrl: [''],
    price: [null as number | null, [Validators.min(0)]],
    published: [false],
  });

  // ---- lesson editor (one lesson open at a time; 'new' = adding)
  readonly editingLesson = signal<string | null>(null);
  readonly lessonForm = this.fb.nonNullable.group({
    title: ltextGroup(this.fb, null, true),
    body: ltextGroup(this.fb),
    video: ['', [youtubeValidator]],
    durationMinutes: [null as number | null, [Validators.min(0), Validators.max(600)]],
    published: [true],
  });
  readonly videoPreview = signal<string | null>(null);

  readonly newQuizTitle = this.fb.nonNullable.control('', [Validators.required]);

  readonly publishedLessons = computed(() => this.lessons().filter((l) => l.published).length);

  constructor() {
    this.lessonForm.controls.video.valueChanges.subscribe((v) =>
      this.videoPreview.set(youtubeId(v)),
    );
    void this.load();
  }

  async load(): Promise<void> {
    try {
      const [course, lessons, quizzes] = await Promise.all([
        this.api.adminCourse(this.id),
        this.api.adminLessons(this.id),
        this.api.adminQuizzes(this.id),
      ]);
      this.course.set(course);
      this.form.reset({ ...course, price: course.price, nextStart: course.nextStart ?? '' });
      this.lessons.set(lessons.sort((a, b) => a.order - b.order));
      this.quizzes.set(quizzes);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : t('Could not load the course.'));
    } finally {
      this.loading.set(false);
    }
  }

  suggestSlug(): void {
    if (!this.form.controls.slug.value) {
      this.form.controls.slug.setValue(slugify(this.form.controls.code.value));
    }
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notify.error(t('Please fix the highlighted fields.'));
      return;
    }
    this.saving.set(true);
    try {
      const value = this.form.getRawValue();
      const saved = await this.api.saveCourse({
        ...this.course()!,
        ...value,
        price: value.price ?? null,
        nextStart: value.nextStart || null,
      });
      this.course.set(saved);
      this.form.markAsPristine();
      this.notify.success(t('Course saved.'));
      void this.catalog.refresh();
    } catch (e) {
      this.notify.error(e instanceof Error ? e.message : t('Could not save.'));
    } finally {
      this.saving.set(false);
    }
  }

  async remove(): Promise<void> {
    const c = this.course();
    if (
      !c ||
      !confirm(
        t('Delete "{name}" with all its lessons, tests and results? This cannot be undone.', {
          name: c.title.en,
        }),
      )
    ) {
      return;
    }
    try {
      await this.api.deleteCourse(c.id);
      this.notify.info(t('Course deleted.'));
      void this.catalog.refresh();
      await this.router.navigateByUrl('/admin/courses');
    } catch (e) {
      this.notify.error(e instanceof Error ? e.message : t('Could not delete.'));
    }
  }

  // ------------------------------------------------------------------ lessons
  editLesson(lesson: Lesson | null): void {
    this.editingLesson.set(lesson?.id ?? 'new');
    this.lessonForm.reset({
      title: lesson?.title ?? { en: '', ka: '' },
      body: lesson?.body ?? { en: '', ka: '' },
      video: lesson?.youtubeId ?? '',
      durationMinutes: lesson?.durationMinutes ?? null,
      published: lesson?.published ?? true,
    });
    this.videoPreview.set(lesson?.youtubeId ?? null);
  }

  cancelLesson(): void {
    this.editingLesson.set(null);
  }

  async saveLesson(): Promise<void> {
    if (this.lessonForm.invalid) {
      this.lessonForm.markAllAsTouched();
      return;
    }
    const editing = this.editingLesson();
    const existing = this.lessons().find((l) => l.id === editing);
    const v = this.lessonForm.getRawValue();
    try {
      const saved = await this.api.saveLesson({
        ...(existing ?? {}),
        id: existing?.id,
        courseId: this.id,
        order: existing?.order ?? this.lessons().length,
        title: v.title,
        body: v.body,
        youtubeId: youtubeId(v.video),
        durationMinutes: v.durationMinutes ?? null,
        published: v.published,
      });
      this.lessons.update((list) =>
        existing ? list.map((l) => (l.id === saved.id ? saved : l)) : [...list, saved],
      );
      this.editingLesson.set(null);
      this.notify.success(t(existing ? 'Lesson saved.' : 'Lesson added.'));
    } catch (e) {
      this.notify.error(e instanceof Error ? e.message : t('Could not save the lesson.'));
    }
  }

  async deleteLesson(lesson: Lesson): Promise<void> {
    if (
      !confirm(
        t('Delete the lesson "{name}"? Students\' progress for it is removed too.', {
          name: lesson.title.en,
        }),
      )
    ) {
      return;
    }
    try {
      await this.api.deleteLesson(lesson.id);
      this.lessons.update((list) => list.filter((l) => l.id !== lesson.id));
      this.notify.info(t('Lesson deleted.'));
    } catch (e) {
      this.notify.error(e instanceof Error ? e.message : t('Could not delete.'));
    }
  }

  async reorderLesson(i: number, delta: number): Promise<void> {
    const before = this.lessons();
    const list = move(before, i, delta).map((l, order) => ({ ...l, order }));
    this.lessons.set(list);
    try {
      await Promise.all(
        list.filter((l, idx) => l.id !== before[idx].id).map((l) => this.api.saveLesson(l)),
      );
    } catch (e) {
      this.notify.error(e instanceof Error ? e.message : t('Could not save the new order.'));
      this.lessons.set(before);
    }
  }

  // ------------------------------------------------------------------ tests
  /** Create the lesson's quiz (or open it if it exists) and go straight to adding questions. */
  async addLessonQuiz(lesson: Lesson): Promise<void> {
    try {
      const quiz = await this.api.lessonQuiz(lesson.id);
      await this.router.navigate(['/admin/tests', quiz.id]);
    } catch (e) {
      this.notify.error(e instanceof Error ? e.message : t('Could not create the quiz.'));
    }
  }

  async addQuiz(): Promise<void> {
    if (this.newQuizTitle.invalid) {
      this.newQuizTitle.markAsTouched();
      return;
    }
    try {
      const quiz = await this.api.saveQuiz({
        courseId: this.id,
        title: { en: this.newQuizTitle.value.trim(), ka: '' },
        passPercent: 70,
        maxAttempts: 3,
        timeLimitMinutes: null,
        shuffle: true,
        showCorrectAnswers: false,
        published: false,
      });
      this.notify.success(t('Test created. Now add the questions.'));
      await this.router.navigate(['/admin/tests', quiz.id]);
    } catch (e) {
      this.notify.error(e instanceof Error ? e.message : t('Could not create the test.'));
    }
  }
}
