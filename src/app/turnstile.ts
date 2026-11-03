import {
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  output,
  viewChild,
} from '@angular/core';
import { TURNSTILE_SITE_KEY } from './auth.config';
import { theme } from './theme';

/** Cloudflare's script API (only what we use). */
interface TurnstileApi {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;

/** Loads Cloudflare's script once, only on pages that show the check. */
function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile'));
    script.onerror = () => {
      loading = null;
      reject(new Error('turnstile'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** True when the "not a robot" check is configured (auth.config.ts TURNSTILE_SITE_KEY). */
export const CAPTCHA_ENABLED = TURNSTILE_SITE_KEY !== '';

/**
 * "I'm not a robot" (Cloudflare Turnstile). Usually invisible: Cloudflare checks the browser in the
 * background and only shows a checkbox when it is unsure. Emits the token the server verifies;
 * a token works once, so forms call reset() after each submit. Shows nothing when switched off.
 *
 *   <app-turnstile (token)="captcha.set($event)" />
 */
@Component({
  selector: 'app-turnstile',
  template: `@if (enabled) {
    <div #box class="turnstile"></div>
  }`,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class TurnstileWidget implements OnDestroy {
  /** The token for the server, or null while there is none (expired, failed, not done yet). */
  readonly token = output<string | null>();
  readonly enabled = CAPTCHA_ENABLED;
  private readonly box = viewChild<ElementRef<HTMLElement>>('box');
  private widgetId: string | null = null;
  private api: TurnstileApi | null = null;

  constructor() {
    afterNextRender(() => {
      const box = this.box()?.nativeElement;
      if (!CAPTCHA_ENABLED || !box) {
        return;
      }
      loadTurnstile()
        .then((api) => {
          this.api = api;
          this.widgetId = api.render(box, {
            sitekey: TURNSTILE_SITE_KEY,
            appearance: 'interaction-only',
            theme: theme(),
            // Turnstile has no Georgian; English avoids its "language not supported" warning.
            language: 'en',
            callback: (t: string) => this.token.emit(t),
            'expired-callback': () => this.token.emit(null),
            'error-callback': () => this.token.emit(null),
          });
        })
        // Cloudflare unreachable: the server lets the form through in that case too.
        .catch(() => this.token.emit('unavailable'));
    });
  }

  /** Get a fresh token (each one works once). */
  reset(): void {
    this.token.emit(null);
    if (this.api && this.widgetId) {
      this.api.reset(this.widgetId);
    }
  }

  ngOnDestroy(): void {
    if (this.api && this.widgetId) {
      this.api.remove(this.widgetId);
    }
  }
}
