import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Notify } from '../../notify';
import { ContentApi } from '../../content/content.api';
import { Question, Quiz } from '../../content/content.models';
import { TrPipe } from '../../content/i18n';
import { ltextGroup, move } from './forms';
import { LTextField } from './ltext-field';

@Component({
  selector: 'app-admin-quiz-edit',
  imports: [ReactiveFormsModule, RouterLink, TrPipe, LTextField, NgTemplateOutlet],
  templateUrl: './quiz-edit.html',
})
export class AdminQuizEdit {
  private readonly api = inject(ContentApi);
  private readonly notify = inject(Notify);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  readonly quiz = signal<Quiz | null>(null);
  readonly questions = signal<Question[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    title: ltextGroup(this.fb, null, true),
    passPercent: [70, [Validators.required, Validators.min(1), Validators.max(100)]],
    maxAttempts: [3, [Validators.required, Validators.min(0), Validators.max(100)]],
    timeLimitMinutes: [null as number | null, [Validators.min(1), Validators.max(600)]],
    shuffle: [true],
    showCorrectAnswers: [false],
    published: [false],
  });

  // ---- question editor ('new' = adding)
  readonly editing = signal<string | null>(null);
  readonly qForm = this.fb.nonNullable.group(
    {
      text: ltextGroup(this.fb, null, true),
      multiple: [false],
      explanation: ltextGroup(this.fb),
      options: this.fb.array([this.option(), this.option()]),
    },
    { validators: [answersValidator] },
  );

  constructor() {
    void this.load();
  }

  private option(text = { en: '', ka: '' }, correct = false, id = '') {
    return this.fb.nonNullable.group({
      id: [id],
      text: ltextGroup(this.fb, text, true),
      correct: [correct],
    });
  }

  get options() {
    return this.qForm.controls.options;
  }

  async load(): Promise<void> {
    try {
      const [quiz, questions] = await Promise.all([
        this.api.adminQuiz(this.id),
        this.api.adminQuestions(this.id),
      ]);
      this.quiz.set(quiz);
      this.form.reset(quiz);
      this.questions.set(questions.sort((a, b) => a.order - b.order));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Could not load the test.');
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notify.error('Please fix the highlighted fields.');
      return;
    }
    const value = this.form.getRawValue();
    if (value.published && !this.questions().length) {
      this.notify.error('Add at least one question before publishing the test.');
      return;
    }
    this.saving.set(true);
    try {
      const saved = await this.api.saveQuiz({
        ...this.quiz()!,
        ...value,
        timeLimitMinutes: value.timeLimitMinutes || null,
      });
      this.quiz.set(saved);
      this.form.markAsPristine();
      this.notify.success('Test settings saved.');
    } catch (e) {
      this.notify.error(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(): Promise<void> {
    const q = this.quiz();
    if (!q || !confirm(`Delete the test "${q.title.en}" and all its results?`)) {
      return;
    }
    try {
      await this.api.deleteQuiz(q.id);
      this.notify.info('Test deleted.');
      await this.router.navigate(['/admin/courses', q.courseId]);
    } catch (e) {
      this.notify.error(e instanceof Error ? e.message : 'Could not delete.');
    }
  }

  // ------------------------------------------------------------------ questions
  edit(question: Question | null): void {
    this.editing.set(question?.id ?? 'new');
    this.options.clear();
    const opts = question?.options.length
      ? question.options
      : // A new question starts with four answers (A–D); remove or add as needed.
        [true, false, false, false].map((correct) => ({
          id: '',
          text: { en: '', ka: '' },
          correct,
        }));
    opts.forEach((o) => this.options.push(this.option(o.text, !!o.correct, o.id)));
    this.qForm.patchValue({
      text: question?.text ?? { en: '', ka: '' },
      multiple: question?.multiple ?? false,
      explanation: question?.explanation ?? { en: '', ka: '' },
    });
    this.qForm.markAsUntouched();
  }

  addOption(): void {
    this.options.push(this.option());
  }

  removeOption(i: number): void {
    if (this.options.length > 2) {
      this.options.removeAt(i);
    }
  }

  /** Single-choice: ticking one answer as correct unticks the others. */
  markCorrect(i: number): void {
    if (!this.qForm.controls.multiple.value) {
      this.options.controls.forEach((c, idx) => c.controls.correct.setValue(idx === i));
    }
  }

  async saveQuestion(): Promise<void> {
    if (this.qForm.invalid) {
      this.qForm.markAllAsTouched();
      return;
    }
    const editing = this.editing();
    const existing = this.questions().find((q) => q.id === editing);
    const v = this.qForm.getRawValue();
    try {
      const saved = await this.api.saveQuestion({
        id: existing?.id,
        quizId: this.id,
        order: existing?.order ?? this.questions().length,
        text: v.text,
        multiple: v.multiple,
        explanation: v.explanation,
        options: v.options.map((o) => ({ id: o.id, text: o.text, correct: o.correct })),
      });
      this.questions.update((list) =>
        existing ? list.map((q) => (q.id === saved.id ? saved : q)) : [...list, saved],
      );
      this.editing.set(null);
      this.notify.success(existing ? 'Question saved.' : 'Question added.');
    } catch (e) {
      this.notify.error(e instanceof Error ? e.message : 'Could not save the question.');
    }
  }

  async deleteQuestion(q: Question): Promise<void> {
    if (!confirm('Delete this question?')) {
      return;
    }
    try {
      await this.api.deleteQuestion(q.id);
      this.questions.update((list) => list.filter((x) => x.id !== q.id));
      this.notify.info('Question deleted.');
    } catch (e) {
      this.notify.error(e instanceof Error ? e.message : 'Could not delete.');
    }
  }

  async reorder(i: number, delta: number): Promise<void> {
    const before = this.questions();
    const list = move(before, i, delta).map((q, order) => ({ ...q, order }));
    this.questions.set(list);
    try {
      await Promise.all(
        list.filter((q, idx) => q.id !== before[idx].id).map((q) => this.api.saveQuestion(q)),
      );
    } catch (e) {
      this.notify.error(e instanceof Error ? e.message : 'Could not save the new order.');
      this.questions.set(before);
    }
  }
}

/** At least 2 answers; at least one correct; single-choice questions exactly one correct. */
function answersValidator(group: AbstractControl): ValidationErrors | null {
  const options = (group.get('options')?.value ?? []) as { correct: boolean }[];
  const multiple = !!group.get('multiple')?.value;
  const correct = options.filter((o) => o.correct).length;
  if (options.length < 2) {
    return { answers: 'Add at least two answers.' };
  }
  if (correct === 0) {
    return { answers: 'Mark the correct answer.' };
  }
  if (!multiple && correct > 1) {
    return { answers: 'A single-choice question has exactly one correct answer.' };
  }
  return null;
}
