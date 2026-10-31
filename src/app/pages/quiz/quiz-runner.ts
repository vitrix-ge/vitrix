import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { Notify } from '../../notify';
import { ContentApi } from '../../content/content.api';
import { AttemptResult, AttemptStart, Question } from '../../content/content.models';
import { TrPipe } from '../../content/i18n';

/**
 * Takes one quiz: start → answer → submit → review. Used inline under a lesson (`mode="lesson"`:
 * unlimited tries, "Try again") and on the final exam page (`mode="exam"`: attempts and timer).
 * Starting creates an attempt on the server; scoring happens there and the browser never receives
 * the correct answers before submitting.
 */
@Component({
  selector: 'app-quiz-runner',
  imports: [TrPipe],
  templateUrl: './quiz-runner.html',
})
export class QuizRunner {
  private readonly api = inject(ContentApi);
  private readonly notify = inject(Notify);

  readonly quizId = input.required<string>();
  readonly mode = input<'lesson' | 'exam'>('exam');
  /** Shown on the start screen of a lesson quiz. */
  readonly questionCount = input<number | undefined>(undefined);
  /** Fires after every submit. */
  readonly finished = output<AttemptResult>();
  /** Exam mode: "Back" on the start screen and result. */
  readonly back = output<void>();

  readonly attempt = signal<AttemptStart | null>(null);
  readonly result = signal<AttemptResult | null>(null);
  readonly answers = signal<Record<string, string[]>>({});
  readonly busy = signal(false);
  readonly error = signal('');
  readonly secondsLeft = signal<number | null>(null);
  private timer: ReturnType<typeof setInterval> | undefined;

  readonly answeredCount = computed(
    () => Object.values(this.answers()).filter((ids) => ids.length > 0).length,
  );
  readonly timeLabel = computed(() => {
    const s = this.secondsLeft();
    return s === null ? '' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
  }

  async start(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    this.result.set(null);
    try {
      const attempt = await this.api.startAttempt(this.quizId());
      this.attempt.set(attempt);
      this.answers.set({});
      if (attempt.expiresAt) {
        this.runTimer(new Date(attempt.expiresAt).getTime());
      }
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Could not start the quiz.');
    } finally {
      this.busy.set(false);
    }
  }

  isChosen(question: Question, optionId: string): boolean {
    return (this.answers()[question.id] ?? []).includes(optionId);
  }

  choose(question: Question, optionId: string, checked: boolean): void {
    this.answers.update((all) => {
      const current = all[question.id] ?? [];
      const next = question.multiple
        ? checked
          ? [...current, optionId]
          : current.filter((id) => id !== optionId)
        : [optionId];
      return { ...all, [question.id]: next };
    });
  }

  async submit(auto = false): Promise<void> {
    const attempt = this.attempt();
    if (!attempt || this.busy()) {
      return;
    }
    const unanswered = attempt.questions.length - this.answeredCount();
    if (!auto && unanswered > 0) {
      this.error.set(
        unanswered === 1
          ? 'Answer the last question first.'
          : `${unanswered} questions are still unanswered.`,
      );
      if (
        this.mode() === 'lesson' ||
        !confirm(`${unanswered} question(s) unanswered. Submit anyway?`)
      ) {
        return;
      }
    }
    this.busy.set(true);
    this.error.set('');
    clearInterval(this.timer);
    try {
      const answers = attempt.questions.map((q) => ({
        questionId: q.id,
        optionIds: this.answers()[q.id] ?? [],
      }));
      const result = await this.api.submitAttempt(attempt.attemptId, answers);
      this.result.set(result);
      if (this.mode() === 'exam') {
        window.scrollTo({ top: 0 });
        if (result.passed) {
          this.notify.success(`Passed with ${result.scorePercent}%. Well done!`);
        }
      }
      this.finished.emit(result);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Could not submit your answers.');
    } finally {
      this.busy.set(false);
    }
  }

  review(questionId: string) {
    return this.result()?.review.find((r) => r.questionId === questionId);
  }

  private runTimer(endsAt: number): void {
    const tick = () => {
      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      this.secondsLeft.set(left);
      if (left === 0) {
        clearInterval(this.timer);
        this.notify.info('Time is up. Your answers were submitted.');
        void this.submit(true);
      }
    };
    tick();
    this.timer = setInterval(tick, 1000);
  }
}
