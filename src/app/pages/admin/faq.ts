import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Notify } from '../../notify';
import { ContentApi } from '../../content/content.api';
import { Course, Faq } from '../../content/content.models';
import { TPipe, TrPipe, t } from '../../content/i18n';
import { ltextGroup, move } from './forms';
import { LTextField } from './ltext-field';

@Component({
  selector: 'app-admin-faq',
  imports: [ReactiveFormsModule, TrPipe, LTextField, NgTemplateOutlet, TPipe],
  templateUrl: './faq.html',
})
export class AdminFaq {
  private readonly api = inject(ContentApi);
  private readonly notify = inject(Notify);
  private readonly fb = inject(FormBuilder);

  readonly faqs = signal<Faq[]>([]);
  readonly courses = signal<Course[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly filter = signal<string>('all'); // 'all' | 'general' | courseId
  readonly editing = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    courseId: [''],
    question: ltextGroup(this.fb, null, true),
    answer: ltextGroup(this.fb, null, true),
    published: [true],
  });

  readonly visible = computed(() => {
    const f = this.filter();
    const list = [...this.faqs()].sort((a, b) => a.order - b.order);
    if (f === 'all') return list;
    if (f === 'general') return list.filter((x) => !x.courseId);
    return list.filter((x) => x.courseId === f);
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    try {
      const [faqs, courses] = await Promise.all([this.api.adminFaqs(), this.api.adminCourses()]);
      this.faqs.set(faqs);
      this.courses.set(courses.sort((a, b) => a.order - b.order));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : t('Could not load questions.'));
    } finally {
      this.loading.set(false);
    }
  }

  courseName(id: string | null): string {
    if (!id) return t('General (Q&A page)');
    const c = this.courses().find((x) => x.id === id);
    return c ? t('{code} course page', { code: c.code }) : t('Course');
  }

  edit(faq: Faq | null): void {
    this.editing.set(faq?.id ?? 'new');
    const f = this.filter();
    this.form.reset({
      courseId: faq ? (faq.courseId ?? '') : f !== 'all' && f !== 'general' ? f : '',
      question: faq?.question ?? { en: '', ka: '' },
      answer: faq?.answer ?? { en: '', ka: '' },
      published: faq?.published ?? true,
    });
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const existing = this.faqs().find((x) => x.id === this.editing());
    const v = this.form.getRawValue();
    try {
      const saved = await this.api.saveFaq({
        id: existing?.id,
        order: existing?.order ?? this.faqs().length,
        courseId: v.courseId || null,
        question: v.question,
        answer: v.answer,
        published: v.published,
      });
      this.faqs.update((list) =>
        existing ? list.map((x) => (x.id === saved.id ? saved : x)) : [...list, saved],
      );
      this.editing.set(null);
      this.notify.success(t(existing ? 'Question saved.' : 'Question added.'));
    } catch (e) {
      this.notify.error(e instanceof Error ? e.message : t('Could not save.'));
    }
  }

  async remove(faq: Faq): Promise<void> {
    if (!confirm(t('Delete this question and answer?'))) return;
    try {
      await this.api.deleteFaq(faq.id);
      this.faqs.update((list) => list.filter((x) => x.id !== faq.id));
      this.notify.info(t('Deleted.'));
    } catch (e) {
      this.notify.error(e instanceof Error ? e.message : t('Could not delete.'));
    }
  }

  async reorder(i: number, delta: number): Promise<void> {
    const before = this.visible();
    const list = move(before, i, delta);
    const orders = before.map((x) => x.order).sort((a, b) => a - b);
    const updated = list.map((x, idx) => ({ ...x, order: orders[idx] }));
    this.faqs.update((all) => all.map((x) => updated.find((u) => u.id === x.id) ?? x));
    try {
      await Promise.all(
        updated.filter((x, idx) => x.id !== before[idx].id).map((x) => this.api.saveFaq(x)),
      );
    } catch (e) {
      this.notify.error(e instanceof Error ? e.message : t('Could not save the new order.'));
      void this.load();
    }
  }
}
