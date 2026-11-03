import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Mark } from '../../mark';
import { ContentApi } from '../../content/content.api';
import { CONTENT_ENABLED } from '../../content/content.config';
import { Certificate } from '../../content/content.models';
import { TPipe } from '../../content/i18n';
import { KA } from '../../content/ka';

/**
 * /certificates/:code — the certificate (Georgian + English on one page), checked live against
 * vitrix-api, so the page itself is the verification. "Save as PDF" uses the browser's print dialog
 * (print styles in styles.scss give an A4 landscape page). /certificates — look up a code.
 */
@Component({
  selector: 'app-certificate',
  imports: [RouterLink, DatePipe, TPipe, Mark],
  templateUrl: './certificate.html',
})
export class CertificatePage {
  private readonly api = inject(ContentApi);
  private readonly router = inject(Router);

  readonly code = signal('');
  readonly cert = signal<Certificate | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly lookup = signal('');

  /** The course title in each language (built-in courses fall back to the site's own Georgian). */
  readonly titleEn = computed(
    () => this.cert()?.courseTitle.en || this.cert()?.courseTitle.ka || '',
  );
  readonly titleKa = computed(() => {
    const title = this.cert()?.courseTitle;
    return title?.ka || KA[title?.en ?? ''] || title?.en || '';
  });
  /** Address printed on the certificate for anyone checking it. */
  readonly verifyUrl = computed(() => {
    if (!this.code()) {
      return '';
    }
    const path = this.router.serializeUrl(
      this.router.createUrlTree(['/certificates', this.code()]),
    );
    // Shown without "https://" to keep it short: vitrix-ge.github.io/vitrix/certificates/VX-…
    return `${location.host}${document.baseURI.replace(location.origin, '').replace(/\/$/, '')}${path}`;
  });

  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        const code = (params.get('code') ?? '').trim().toUpperCase();
        this.code.set(code);
        this.lookup.set(code);
        void this.load(code);
      });
  }

  private async load(code: string): Promise<void> {
    this.cert.set(null);
    this.error.set('');
    if (!code) {
      return;
    }
    if (!CONTENT_ENABLED) {
      this.error.set('The course server is not reachable. Please try again later.');
      return;
    }
    this.loading.set(true);
    try {
      this.cert.set(await this.api.certificate(code));
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  check(): void {
    const code = this.lookup().trim().toUpperCase();
    if (code) {
      void this.router.navigate(['/certificates', code]);
    }
  }

  print(): void {
    window.print();
  }
}
