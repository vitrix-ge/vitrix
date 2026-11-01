import { effect, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'vitrix.theme';

function savedTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** Light (default, the brand look) or dark. The header switch changes it (remembered per browser). */
export const theme = signal<Theme>(savedTheme());

export function toggleTheme(): void {
  const next: Theme = theme() === 'dark' ? 'light' : 'dark';
  theme.set(next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // Storage blocked: the choice lasts for this visit only.
  }
}

/** Applies <html data-theme="…">; styles.scss switches the color variables. Call once from the app shell. */
export function syncDocumentTheme(): void {
  effect(() => {
    document.documentElement.dataset['theme'] = theme();
  });
}
