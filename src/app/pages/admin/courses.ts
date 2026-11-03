import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Notify } from '../../notify';
import { Catalog } from '../../content/catalog';
import { ContentApi } from '../../content/content.api';
import { Course, LText } from '../../content/content.models';
import { KA } from '../../content/ka';
import { TPipe, TrPipe, t } from '../../content/i18n';
import { move, slugify } from './forms';

@Component({
  selector: 'app-admin-courses',
  imports: [RouterLink, ReactiveFormsModule, TrPipe, TPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './courses.html',
})
export class AdminCourses {
  private readonly api = inject(ContentApi);
  private readonly notify = inject(Notify);
  private readonly router = inject(Router);
  private readonly catalog = inject(Catalog);
  private readonly fb = inject(FormBuilder);

  readonly courses = signal<Course[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly creating = signal(false);
  readonly busy = signal(false);

  /**
   * Courses whose Georgian fields are empty although the site has its own Georgian for the English
   * text (ka.ts — the built-in courses). Visitors already see that Georgian; this saves it into the
   * course so it shows in the editor and can be changed there.
   */
  readonly georgianToFill = computed(() =>
    this.courses()
      .map((course) => ({ course, filled: withSiteGeorgian(course) }))
      .filter((x) => x.filled !== null),
  );

  readonly newForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(30)]],
    title: ['', [Validators.required, Validators.maxLength(150)]],
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    try {
      this.courses.set((await this.api.adminCourses()).sort((a, b) => a.order - b.order));
      this.error.set('');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : t('Could not load courses.'));
    } finally {
      this.loading.set(false);
    }
  }

  async create(): Promise<void> {
    if (this.newForm.invalid) {
      this.newForm.markAllAsTouched();
      return;
    }
    const { code, title } = this.newForm.getRawValue();
    this.busy.set(true);
    try {
      const course = await this.api.saveCourse({
        code: code.trim(),
        slug: slugify(code),
        title: { en: title.trim(), ka: '' },
        summary: { en: '', ka: '' },
        description: { en: '', ka: '' },
        imageUrl: '',
        price: null,
        published: false,
        order: this.courses().length,
      });
      this.notify.success(t('Course created as a draft. Add the details, lessons and tests.'));
      await this.router.navigate(['/admin/courses', course.id]);
    } catch (e) {
      this.notify.error(e instanceof Error ? e.message : t('Could not create the course.'));
    } finally {
      this.busy.set(false);
    }
  }

  async fillGeorgian(): Promise<void> {
    const todo = this.georgianToFill();
    if (!todo.length) {
      return;
    }
    this.busy.set(true);
    let saved = 0;
    try {
      for (const { filled } of todo) {
        const result = await this.api.saveCourse(filled!);
        this.courses.update((list) => list.map((c) => (c.id === result.id ? result : c)));
        saved++;
      }
      this.notify.success(
        t('Georgian text saved for {n} course(s). You can edit it in each course.', { n: saved }),
      );
      void this.catalog.refresh();
    } catch (e) {
      this.notify.error(e instanceof Error ? e.message : t('Could not save.'));
    } finally {
      this.busy.set(false);
    }
  }

  async togglePublished(course: Course): Promise<void> {
    try {
      const saved = await this.api.saveCourse({ ...course, published: !course.published });
      this.courses.update((list) => list.map((c) => (c.id === saved.id ? saved : c)));
      this.notify.success(
        t(saved.published ? 'Course is now visible on the site.' : 'Course hidden from the site.'),
      );
      void this.catalog.refresh();
    } catch (e) {
      this.notify.error(e instanceof Error ? e.message : t('Could not save.'));
    }
  }

  async reorder(i: number, delta: number): Promise<void> {
    const list = move(this.courses(), i, delta).map((c, order) => ({ ...c, order }));
    const changed = list.filter((c, idx) => c.id !== this.courses()[idx].id);
    this.courses.set(list);
    try {
      await Promise.all(changed.map((c) => this.api.saveCourse(c)));
      void this.catalog.refresh();
    } catch (e) {
      this.notify.error(e instanceof Error ? e.message : t('Could not save the new order.'));
      void this.load();
    }
  }
}

const FIELDS = ['title', 'summary', 'description', 'format', 'duration', 'outcomes'] as const;

/** The course with empty Georgian fields filled from ka.ts, or null when there is nothing to fill. */
function withSiteGeorgian(course: Course): Course | null {
  let changed = false;
  const copy: Course = { ...course };
  for (const field of FIELDS) {
    const text = course[field] as LText | undefined;
    const georgian = text && !text.ka.trim() && text.en.trim() ? KA[text.en.trim()] : undefined;
    if (georgian) {
      (copy[field] as LText) = { en: text!.en, ka: georgian };
      changed = true;
    }
  }
  return changed ? copy : null;
}
