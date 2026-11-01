import { Pipe, PipeTransform, effect, signal } from '@angular/core';
import { LText } from './content.models';
import { KA } from './ka';

export type Lang = 'en' | 'ka';

const LANG_KEY = 'vitrix.lang';

function savedLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    return saved === 'en' || saved === 'ka' ? saved : 'ka';
  } catch {
    return 'ka';
  }
}

/** Current site language. Georgian by default; the header switch changes it (remembered per browser). */
export const lang = signal<Lang>(savedLang());

/**
 * A page's own browser-tab title (e.g. the course name), shown instead of the route's `data.title`.
 * Cleared on every navigation; set it from the page once its content has loaded.
 */
export const pageTitleOverride = signal<string | null>(null);

export function setLang(value: Lang): void {
  lang.set(value);
  try {
    localStorage.setItem(LANG_KEY, value);
  } catch {
    // Storage blocked: the choice lasts for this visit only.
  }
}

/** Keeps <html lang> in sync (screen readers, hyphenation, Georgian font rules). Call once from the app shell. */
export function syncDocumentLang(): void {
  effect(() => {
    document.documentElement.lang = lang();
  });
}

/** Content from the server ({ en, ka }) in the current language, falling back to the other one. */
export function tr(text: LText | null | undefined): string {
  if (!text) {
    return '';
  }
  if (lang() === 'ka' && !text.ka && text.en) {
    // Not translated in the admin panel yet: use the site's own Georgian for known texts
    // (e.g. the built-in course descriptions), otherwise show the English.
    return t(text.en);
  }
  const other: Lang = lang() === 'en' ? 'ka' : 'en';
  return text[lang()] || text[other] || '';
}

export function emptyText(): LText {
  return { en: '', ka: '' };
}

/**
 * Interface text: written in English in the code, translated with the KA dictionary (ka.ts).
 * `{name}` placeholders are filled from `params`. Untranslated text stays English.
 */
export function t(
  text: string,
  params?: Record<string, string | number | null | undefined>,
): string {
  let out = lang() === 'ka' ? (KA[text] ?? text) : text;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      out = out.split(`{${key}}`).join(String(value ?? ''));
    }
  }
  return out;
}

/** {{ course.title | tr }} — server content in the current language. */
@Pipe({ name: 'tr', pure: false })
export class TrPipe implements PipeTransform {
  transform(text: LText | null | undefined): string {
    return tr(text);
  }
}

/** {{ 'Log in' | t }} or {{ 'Welcome back, {name}.' | t: { name: user.name } }} — interface text. */
@Pipe({ name: 't', pure: false })
export class TPipe implements PipeTransform {
  transform(text: string, params?: Record<string, string | number | null | undefined>): string {
    return t(text, params);
  }
}
