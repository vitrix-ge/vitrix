import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { Auth } from '../auth';
import { isStaff } from '../content/roles';
import { CONTENT_ENABLED } from '../content/content.config';
import { COURSES, NAV } from '../site-data';
import { Mark } from '../mark';
import { Notify } from '../notify';
import { TPipe, lang, setLang, t } from '../content/i18n';
import { theme, toggleTheme } from '../theme';

@Component({
  selector: 'app-site-header',
  imports: [RouterLink, RouterLinkActive, Mark, TPipe],
  templateUrl: './site-header.html',
  styleUrl: './site-header.scss',
})
export class SiteHeader {
  private readonly router = inject(Router);
  private readonly auth = inject(Auth);
  readonly authEnabled = this.auth.enabled;
  readonly user = this.auth.user;
  readonly staff = computed(() => CONTENT_ENABLED && isStaff(this.auth.user()));
  readonly nav = NAV;
  private readonly notify = inject(Notify);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  readonly menuOpen = signal(false);
  /** The account menu (avatar button). */
  readonly userOpen = signal(false);
  /** "Nino Beridze" → "NB"; one name → its first letter. */
  readonly initials = computed(() => {
    const name = this.user()?.name ?? '';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return (
      parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?')[0]
    ).toUpperCase();
  });
  readonly searchOpen = signal(false);
  readonly query = signal('');
  readonly lang = lang;
  readonly setLang = setLang;
  readonly theme = theme;
  readonly toggleTheme = toggleTheme;

  readonly results = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) {
      return [];
    }

    const pages = NAV.filter((item) =>
      `${item.label} ${t(item.label)}`.toLowerCase().includes(q),
    ).map((item) => ({
      label: t(item.label),
      path: item.path,
      fragment: undefined as string | undefined,
    }));

    const courses = COURSES.filter((course) =>
      `${course.code} ${course.name} ${t(course.name)}`.toLowerCase().includes(q),
    ).map((course) => ({
      label: `${course.code} — ${t(course.name)}`,
      path: '/courses',
      fragment: course.id,
    }));

    return [...pages, ...courses];
  });

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.menuOpen.set(false);
      this.searchOpen.set(false);
      this.userOpen.set(false);
      this.query.set('');
    });
  }

  toggleUser(): void {
    this.userOpen.update((open) => !open);
    this.searchOpen.set(false);
    this.menuOpen.set(false);
  }

  logout(): void {
    this.auth.logout();
    this.userOpen.set(false);
    this.menuOpen.set(false);
    this.notify.info(t('You have been logged out.'));
    void this.router.navigateByUrl('/');
  }

  /** Close the account menu when clicking anywhere outside it. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.userOpen()) {
      const menu = this.host.nativeElement.querySelector('.user-menu');
      if (menu && !menu.contains(event.target as Node)) {
        this.userOpen.set(false);
      }
    }
  }

  toggleSearch(): void {
    this.searchOpen.update((open) => !open);
    this.menuOpen.set(false);
    this.userOpen.set(false);
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
    this.searchOpen.set(false);
    this.userOpen.set(false);
  }

  onQuery(value: string): void {
    this.query.set(value);
  }

  @HostListener('document:keydown.escape')
  closeOverlays(): void {
    this.searchOpen.set(false);
    this.menuOpen.set(false);
    this.userOpen.set(false);
  }
}
