import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { SiteFooter } from './layout/site-footer';
import { SiteHeader } from './layout/site-header';
import { Auth } from './auth';
import { Notify } from './notify';
import { TPipe, syncDocumentLang, t } from './content/i18n';
import { syncDocumentTheme } from './theme';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SiteHeader, SiteFooter, TPipe],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly notify = inject(Notify);

  constructor() {
    const router = inject(Router);
    const title = inject(Title);
    const destroyRef = inject(DestroyRef);

    // Restore a saved session (refreshing the token if needed).
    inject(Auth).init();

    syncDocumentLang();
    syncDocumentTheme();

    // Browser tab title in the current language (updates when the language changes too).
    const pageTitle = signal<string | undefined>(undefined);
    effect(() => {
      const page = pageTitle();
      title.setTitle(page ? `${t(page)} · VITRIX` : 'VITRIX');
    });

    router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(() => {
        let route = router.routerState.root;
        while (route.firstChild) {
          route = route.firstChild;
        }
        pageTitle.set(route.snapshot.data['title'] as string | undefined);
      });
  }
}
