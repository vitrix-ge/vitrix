import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ContentApi } from '../../content/content.api';
import { AttemptRow } from '../../content/content.models';
import { TPipe, TrPipe, t, tr } from '../../content/i18n';

/** Admin only: every submitted test attempt, filterable, exportable as CSV. */
@Component({
  selector: 'app-admin-results',
  imports: [TrPipe, DatePipe, TPipe],
  templateUrl: './results.html',
})
export class AdminResults {
  private readonly api = inject(ContentApi);
  readonly rows = signal<AttemptRow[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly quizFilter = signal('');
  readonly status = signal<'' | 'passed' | 'failed'>('');
  readonly search = signal('');

  readonly quizzes = computed(() => {
    const seen = new Map<string, string>();
    this.rows().forEach((r) => seen.set(r.quizId, `${tr(r.courseTitle)} — ${tr(r.quizTitle)}`));
    return [...seen.entries()].map(([id, label]) => ({ id, label }));
  });

  readonly visible = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.rows()
      .filter((r) => !this.quizFilter() || r.quizId === this.quizFilter())
      .filter((r) => !this.status() || (this.status() === 'passed') === r.passed)
      .filter(
        (r) => !q || r.userEmail.toLowerCase().includes(q) || r.userName.toLowerCase().includes(q),
      )
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  });

  readonly summary = computed(() => {
    const list = this.visible();
    const passed = list.filter((r) => r.passed).length;
    const avg = list.length
      ? Math.round(list.reduce((s, r) => s + r.scorePercent, 0) / list.length)
      : 0;
    return { total: list.length, passed, avg };
  });

  constructor() {
    this.api
      .attempts()
      .then((rows) => this.rows.set(rows))
      .catch((e) => this.error.set(e instanceof Error ? e.message : t('Could not load results.')))
      .finally(() => this.loading.set(false));
  }

  exportCsv(): void {
    const header = ['Date', 'Name', 'Email', 'Course', 'Test', 'Score %', 'Passed'];
    const lines = this.visible().map((r) => [
      r.submittedAt,
      r.userName,
      r.userEmail,
      tr(r.courseTitle),
      tr(r.quizTitle),
      String(r.scorePercent),
      r.passed ? 'yes' : 'no',
    ]);
    const csv = [header, ...lines]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `vitrix-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
