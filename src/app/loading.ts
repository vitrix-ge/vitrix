import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  OnDestroy,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { finalize } from 'rxjs';
import { TPipe } from './content/i18n';

/** After this long, say why it is slow: Render's free plan sleeps after 15 quiet minutes. */
const SLOW_AFTER_MS = 6000;

/**
 * A spinner with a short text, for parts of a page that wait for the servers:
 *   <app-loading />   <app-loading text="Loading course…" />
 * After a few seconds it adds that the server may be waking up (up to a minute on the free plan).
 */
@Component({
  selector: 'app-loading',
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="loading-block" role="status" aria-live="polite">
      <span class="spinner" aria-hidden="true"></span>
      <div>
        <p>{{ text() | t }}</p>
        @if (slow()) {
          <p class="lesson-meta">
            {{ 'The server is waking up after a quiet period. This can take up to a minute.' | t }}
          </p>
        }
      </div>
    </div>
  `,
})
export class Loading implements OnDestroy {
  readonly text = input('Loading…');
  readonly slow = signal(false);
  private readonly timer = setTimeout(() => this.slow.set(true), SLOW_AFTER_MS);

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }
}

/** Counts requests to our servers in flight; the app shell shows a thin bar while there are any. */
@Injectable({ providedIn: 'root' })
export class LoadingBar {
  private readonly pending = signal(0);
  /** Shown only for requests that take a moment, so quick ones don't flash. */
  readonly visible = signal(false);
  readonly active = computed(() => this.pending() > 0);
  private showTimer: ReturnType<typeof setTimeout> | undefined;

  start(): void {
    this.pending.update((n) => n + 1);
    if (this.pending() === 1) {
      this.showTimer = setTimeout(() => this.visible.set(true), 250);
    }
  }

  stop(): void {
    this.pending.update((n) => Math.max(0, n - 1));
    if (this.pending() === 0) {
      clearTimeout(this.showTimer);
      this.visible.set(false);
    }
  }
}

/** Every HTTP request moves the top loading bar. */
export const loadingBarInterceptor: HttpInterceptorFn = (req, next) => {
  const bar = inject(LoadingBar);
  bar.start();
  return next(req).pipe(finalize(() => bar.stop()));
};
