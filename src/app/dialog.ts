import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injectable,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { TPipe } from './content/i18n';

export interface ConfirmOptions {
  /** Short question, e.g. "Delete this lesson?" (already translated). */
  title: string;
  /** Optional details under the title (already translated). */
  message?: string;
  /** Text of the confirm button (already translated); default "OK". */
  confirm?: string;
  /** Text of the cancel button (already translated); default "Cancel". */
  cancel?: string;
  /** 'danger' = red confirm button and the focus starts on Cancel (deleting, removing …). */
  tone?: 'danger' | 'default';
}

interface Open extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

/**
 * Confirmation dialogs in the site's own style, instead of the browser's confirm() box.
 *
 *   if (!(await this.dialog.confirm({ title: t('Delete this lesson?'), tone: 'danger' }))) return;
 *
 * Shown by <app-dialog-host> in the app shell (a native <dialog>: Esc and a click outside cancel,
 * keyboard focus stays inside while it is open).
 */
@Injectable({ providedIn: 'root' })
export class Dialog {
  readonly current = signal<Open | null>(null);

  confirm(options: ConfirmOptions): Promise<boolean> {
    // One at a time: a new question cancels one that is still open.
    this.current()?.resolve(false);
    return new Promise<boolean>((resolve) => this.current.set({ ...options, resolve }));
  }

  /** Called by the host when the person answers. */
  close(ok: boolean): void {
    const open = this.current();
    this.current.set(null);
    open?.resolve(ok);
  }
}

@Component({
  selector: 'app-dialog-host',
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <dialog
      #box
      class="confirm-dialog"
      [class.is-danger]="open()?.tone === 'danger'"
      aria-labelledby="confirm-title"
      (cancel)="$event.preventDefault(); dialog.close(false)"
      (keydown.escape)="dialog.close(false)"
      (click)="backdrop($event)"
    >
      @if (open(); as o) {
        <div class="confirm-body">
          <span class="confirm-icon" aria-hidden="true">{{ o.tone === 'danger' ? '!' : '?' }}</span>
          <div>
            <h2 id="confirm-title">{{ o.title }}</h2>
            @if (o.message) {
              <p>{{ o.message }}</p>
            }
          </div>
        </div>
        <div class="confirm-actions">
          <button
            type="button"
            class="btn btn-ghost"
            (click)="dialog.close(false)"
            [attr.autofocus]="o.tone === 'danger' ? '' : null"
          >
            {{ o.cancel || ('Cancel' | t) }}
          </button>
          <button
            type="button"
            class="btn btn-red"
            (click)="dialog.close(true)"
            [attr.autofocus]="o.tone === 'danger' ? null : ''"
          >
            {{ o.confirm || ('OK' | t) }}
          </button>
        </div>
      }
    </dialog>
  `,
})
export class DialogHost {
  protected readonly dialog = inject(Dialog);
  protected readonly open = this.dialog.current;
  private readonly box = viewChild.required<ElementRef<HTMLDialogElement>>('box');

  constructor() {
    effect(() => {
      const el = this.box().nativeElement;
      if (this.open() && !el.open) {
        el.showModal();
        // The buttons render with the dialog content; focus the right one once they exist.
        queueMicrotask(() => el.querySelector<HTMLElement>('[autofocus]')?.focus());
      } else if (!this.open() && el.open) {
        el.close();
      }
    });
  }

  /** A click on the dark area around the box (the <dialog> itself, not its content) cancels. */
  protected backdrop(event: MouseEvent): void {
    if (event.target === this.box().nativeElement) {
      this.dialog.close(false);
    }
  }
}
