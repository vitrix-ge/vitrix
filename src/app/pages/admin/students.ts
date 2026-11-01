import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Notify } from '../../notify';
import { ContentApi } from '../../content/content.api';
import { Course, Enrollment } from '../../content/content.models';
import { TPipe, TrPipe, t } from '../../content/i18n';

/** Admin only: who can open which course. Enrol by email — works before they create an account. */
@Component({
  selector: 'app-admin-students',
  imports: [ReactiveFormsModule, TrPipe, DatePipe, TPipe],
  templateUrl: './students.html',
})
export class AdminStudents {
  private readonly api = inject(ContentApi);
  private readonly notify = inject(Notify);
  private readonly fb = inject(FormBuilder);

  readonly enrollments = signal<Enrollment[]>([]);
  readonly courses = signal<Course[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly courseFilter = signal('');
  readonly search = signal('');

  readonly form = this.fb.nonNullable.group({
    courseId: ['', Validators.required],
    emails: ['', Validators.required],
  });

  readonly visible = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.enrollments()
      .filter((e) => !this.courseFilter() || e.courseId === this.courseFilter())
      .filter((e) => !q || e.email.includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    try {
      const [enrollments, courses] = await Promise.all([
        this.api.enrollments(),
        this.api.adminCourses(),
      ]);
      this.enrollments.set(enrollments);
      this.courses.set(courses.sort((a, b) => a.order - b.order));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : t('Could not load students.'));
    } finally {
      this.loading.set(false);
    }
  }

  async enroll(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { courseId, emails } = this.form.getRawValue();
    const list = [
      ...new Set(
        emails
          .split(/[\s,;]+/)
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    const bad = list.filter((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
    if (bad.length) {
      this.notify.error(t('Not a valid email: {list}', { list: bad.join(', ') }));
      return;
    }
    this.busy.set(true);
    let added = 0;
    const failed: string[] = [];
    for (const email of list) {
      try {
        const enrollment = await this.api.enroll(courseId, email);
        this.enrollments.update((all) => [
          enrollment,
          ...all.filter((x) => x.id !== enrollment.id),
        ]);
        added++;
      } catch (e) {
        failed.push(`${email} (${e instanceof Error ? e.message : t('error')})`);
      }
    }
    this.busy.set(false);
    if (added) {
      this.notify.success(
        t('{n} student(s) enrolled. They see the course in My account.', { n: added }),
      );
      this.form.controls.emails.reset('');
    }
    if (failed.length) {
      this.notify.error(t('Not enrolled: {list}', { list: failed.join('; ') }));
    }
  }

  async remove(e: Enrollment): Promise<void> {
    if (!confirm(t('Remove {email} from this course? Their results are kept.', { email: e.email })))
      return;
    try {
      await this.api.unenroll(e.id);
      this.enrollments.update((all) => all.filter((x) => x.id !== e.id));
      this.notify.info(t('Removed from the course.'));
    } catch (err) {
      this.notify.error(err instanceof Error ? err.message : t('Could not remove.'));
    }
  }
}
