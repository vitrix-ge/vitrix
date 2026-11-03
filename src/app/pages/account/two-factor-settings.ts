import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Auth, TwoFactorStatus } from '../../auth';
import { Notify } from '../../notify';
import { TPipe, t } from '../../content/i18n';
import { isStaff } from '../../content/roles';

type Step = 'loading' | 'off' | 'setup' | 'codes' | 'on' | 'error';

/**
 * Account settings → Two-step login (authenticator app). Turning it on: scan the QR code, enter the
 * first code, keep the recovery codes. Turning it off or making new recovery codes needs a code.
 * The QR code is drawn in the browser (the secret never goes to another service).
 */
@Component({
  selector: 'app-two-factor-settings',
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="admin-card two-factor" id="two-factor">
      <div class="two-factor-head">
        <div>
          <h2>{{ 'Two-step login' | t }}</h2>
          <p class="lesson-meta">
            {{
              'After your password, VITRIX also asks for a code from an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, 1Password …). Someone who learns your password still cannot log in.'
                | t
            }}
          </p>
        </div>
        @if (status(); as s) {
          <span class="tag" [class.tag-ok]="s.enabled">{{ (s.enabled ? 'On' : 'Off') | t }}</span>
        }
      </div>

      @if (staff() && step() === 'off') {
        <p class="notice-inline">
          {{ 'You have staff access: please turn this on to protect students’ data.' | t }}
        </p>
      }

      @switch (step()) {
        @case ('loading') {
          <p class="lesson-meta">{{ 'Loading…' | t }}</p>
        }
        @case ('error') {
          <p class="error" role="alert">{{ error() | t }}</p>
        }
        @case ('off') {
          @if (error()) {
            <p class="error" role="alert">{{ error() | t }}</p>
          }
          <div class="form-actions">
            <button type="button" class="btn btn-red" (click)="startSetup()" [disabled]="busy()">
              {{ 'Turn on two-step login' | t }}
            </button>
          </div>
        }
        @case ('setup') {
          <ol class="setup-steps">
            <li>
              {{ 'Install an authenticator app on your phone if you do not have one.' | t }}
            </li>
            <li>
              {{ 'In the app, add an account and scan this QR code:' | t }}
              <div class="qr-box">
                @if (qr()) {
                  <img
                    [src]="qr()"
                    width="200"
                    height="200"
                    [alt]="'QR code for the authenticator app' | t"
                  />
                }
                <div>
                  <p class="lesson-meta">{{ 'Cannot scan? Type this key instead:' | t }}</p>
                  <code class="secret-key">{{ prettyKey() }}</code>
                </div>
              </div>
            </li>
            <li>
              {{ 'Enter the 6-digit code the app shows:' | t }}
              <div class="inline-form code-form">
                <input
                  type="text"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  maxlength="7"
                  placeholder="123 456"
                  [value]="code()"
                  (input)="code.set($any($event.target).value)"
                  (keydown.enter)="enable()"
                  [attr.aria-label]="'Code' | t"
                />
                <button type="button" class="btn btn-red" (click)="enable()" [disabled]="busy()">
                  {{ (busy() ? 'Checking…' : 'Turn on') | t }}
                </button>
              </div>
            </li>
          </ol>
          @if (error()) {
            <p class="error" role="alert">{{ error() | t }}</p>
          }
          <button type="button" class="form-link" (click)="cancel()">{{ 'Cancel' | t }}</button>
        }
        @case ('codes') {
          <div class="notice notice-ok">
            <h3>{{ 'Save your recovery codes' | t }}</h3>
            <p>
              {{
                'If you lose your phone, each of these codes lets you log in once instead of the app code. Keep them somewhere safe (a password manager or printed). They are shown only now.'
                  | t
              }}
            </p>
            <ul class="recovery-codes">
              @for (c of recoveryCodes(); track c) {
                <li>
                  <code>{{ c }}</code>
                </li>
              }
            </ul>
            <div class="form-actions">
              <button type="button" class="btn btn-ghost" (click)="copyCodes()">
                {{ 'Copy' | t }}
              </button>
              <button type="button" class="btn btn-ghost" (click)="downloadCodes()">
                {{ 'Download' | t }}
              </button>
              <button type="button" class="btn btn-red" (click)="savedCodes()">
                {{ 'I have saved them' | t }}
              </button>
            </div>
          </div>
        }
        @case ('on') {
          <p>
            {{ 'Recovery codes left: {n}' | t: { n: status()?.recoveryCodesLeft ?? 0 } }}
          </p>
          @if (action()) {
            <div class="inline-form code-form">
              <input
                type="text"
                inputmode="numeric"
                autocomplete="one-time-code"
                maxlength="20"
                [placeholder]="'Code from the app' | t"
                [value]="code()"
                (input)="code.set($any($event.target).value)"
                (keydown.enter)="confirmAction()"
                [attr.aria-label]="'Code' | t"
              />
              <button
                type="button"
                class="btn"
                [class.btn-red]="action() === 'codes'"
                [class.btn-danger]="action() === 'off'"
                (click)="confirmAction()"
                [disabled]="busy()"
              >
                {{ (action() === 'off' ? 'Turn off' : 'Get new codes') | t }}
              </button>
              <button type="button" class="btn btn-ghost" (click)="action.set(null)">
                {{ 'Cancel' | t }}
              </button>
            </div>
            @if (error()) {
              <p class="error" role="alert">{{ error() | t }}</p>
            }
          } @else {
            <div class="form-actions">
              <button type="button" class="btn btn-ghost" (click)="ask('codes')">
                {{ 'New recovery codes' | t }}
              </button>
              <button type="button" class="btn btn-danger" (click)="ask('off')">
                {{ 'Turn off two-step login' | t }}
              </button>
            </div>
          }
        }
      }
    </section>
  `,
})
export class TwoFactorSettings {
  private readonly auth = inject(Auth);
  private readonly notify = inject(Notify);

  readonly staff = computed(() => isStaff(this.auth.user()));
  readonly step = signal<Step>('loading');
  readonly status = signal<TwoFactorStatus | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly code = signal('');
  readonly key = signal('');
  readonly qr = signal('');
  readonly recoveryCodes = signal<string[]>([]);
  /** While on: which change waits for a code. */
  readonly action = signal<'off' | 'codes' | null>(null);
  readonly prettyKey = computed(() =>
    this.key()
      .replace(/(.{4})/g, '$1 ')
      .trim(),
  );

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const status = await this.auth.twoFactorStatus();
      this.status.set(status);
      this.step.set(status.enabled ? 'on' : 'off');
    } catch (e) {
      this.error.set((e as Error).message);
      this.step.set('error');
    }
  }

  async startSetup(): Promise<void> {
    await this.run(async () => {
      const { key, uri } = await this.auth.twoFactorSetup();
      this.key.set(key);
      // Loaded only here, so other pages don't carry the QR code library.
      // (qrcode is a CommonJS package: its functions sit on `default` once bundled.)
      const mod = await import('qrcode');
      const QRCode = ((mod as unknown as { default?: typeof mod }).default ?? mod) as typeof mod;
      this.qr.set(await QRCode.toDataURL(uri, { width: 200, margin: 1 }));
      this.code.set('');
      this.step.set('setup');
    });
  }

  async enable(): Promise<void> {
    await this.run(async () => {
      const codes = await this.auth.twoFactorEnable(this.code());
      this.recoveryCodes.set(codes);
      this.key.set('');
      this.qr.set('');
      this.step.set('codes');
      this.notify.success(t('Two-step login is on.'));
    });
  }

  cancel(): void {
    this.key.set('');
    this.qr.set('');
    this.error.set('');
    this.step.set('off');
  }

  ask(action: 'off' | 'codes'): void {
    this.code.set('');
    this.error.set('');
    this.action.set(action);
  }

  async confirmAction(): Promise<void> {
    const action = this.action();
    await this.run(async () => {
      if (action === 'off') {
        await this.auth.twoFactorDisable(this.code());
        this.action.set(null);
        this.notify.info(t('Two-step login is off.'));
        await this.load();
      } else if (action === 'codes') {
        this.recoveryCodes.set(await this.auth.twoFactorNewRecoveryCodes(this.code()));
        this.action.set(null);
        this.step.set('codes');
      }
    });
  }

  async copyCodes(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.recoveryCodes().join('\n'));
      this.notify.success(t('Copied.'));
    } catch {
      this.notify.error(t('Could not copy. Select the codes and copy them yourself.'));
    }
  }

  downloadCodes(): void {
    const text = `VITRIX recovery codes (${this.auth.user()?.email ?? ''})\n\n${this.recoveryCodes().join('\n')}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vitrix-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  async savedCodes(): Promise<void> {
    this.recoveryCodes.set([]);
    await this.load();
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await action();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
