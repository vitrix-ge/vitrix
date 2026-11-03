import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Notify } from '../../notify';
import { ContentApi } from '../../content/content.api';
import {
  APPLICATION_STATUSES,
  ApplicationRow,
  ApplicationStatus,
  ContactMessage,
} from '../../content/content.models';
import { TPipe, TrPipe, t } from '../../content/i18n';

/** Admin labels for application statuses. */
const STATUS_TEXT: Record<ApplicationStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

/**
 * Admin only: the inbox. Applications (Apply form) with status, private note and "Accept & enroll";
 * messages (Contact form) with "handled". The team also gets each one by email.
 */
@Component({
  selector: 'app-admin-applications',
  imports: [DatePipe, TPipe, TrPipe],
  templateUrl: './applications.html',
})
export class AdminApplications {
  private readonly api = inject(ContentApi);
  private readonly notify = inject(Notify);

  readonly statuses = APPLICATION_STATUSES;
  readonly tab = signal<'applications' | 'messages'>('applications');
  readonly applications = signal<ApplicationRow[]>([]);
  readonly messages = signal<ContactMessage[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly statusFilter = signal<ApplicationStatus | 'open' | ''>('open');
  readonly showHandled = signal(false);
  readonly search = signal('');
  readonly busyId = signal<string | null>(null);

  readonly visibleApplications = computed(() => {
    const q = this.search().trim().toLowerCase();
    const f = this.statusFilter();
    return this.applications()
      .filter((a) =>
        f === 'open' ? a.status === 'new' || a.status === 'contacted' : !f || a.status === f,
      )
      .filter(
        (a) =>
          !q ||
          a.name.toLowerCase().includes(q) ||
          a.email.includes(q) ||
          a.courseCode.toLowerCase().includes(q),
      );
  });
  readonly visibleMessages = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.messages()
      .filter((m) => this.showHandled() || !m.handled)
      .filter(
        (m) =>
          !q ||
          m.name.toLowerCase().includes(q) ||
          m.email.includes(q) ||
          m.organization.toLowerCase().includes(q),
      );
  });
  readonly newApplications = computed(
    () => this.applications().filter((a) => a.status === 'new').length,
  );
  readonly openMessages = computed(() => this.messages().filter((m) => !m.handled).length);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [applications, messages] = await Promise.all([
        this.api.applications(),
        this.api.messages(),
      ]);
      this.applications.set(applications);
      this.messages.set(messages);
      this.error.set('');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : t('Could not load the inbox.'));
    } finally {
      this.loading.set(false);
    }
  }

  statusText(status: ApplicationStatus): string {
    return STATUS_TEXT[status] ?? status;
  }

  async setStatus(a: ApplicationRow, status: string): Promise<void> {
    await this.update(a, () =>
      this.api.updateApplication(a.id, { status: status as ApplicationStatus }),
    );
  }

  async saveNote(a: ApplicationRow, note: string): Promise<void> {
    if (note.trim() === a.note) {
      return;
    }
    await this.update(a, () => this.api.updateApplication(a.id, { note }), t('Note saved.'));
  }

  async accept(a: ApplicationRow): Promise<void> {
    if (!confirm(t('Enrol {email} in {course}?', { email: a.email, course: a.courseCode }))) {
      return;
    }
    await this.update(
      a,
      () => this.api.acceptApplication(a.id),
      t('{email} is enrolled. The course appears in their account.', { email: a.email }),
    );
  }

  async removeApplication(a: ApplicationRow): Promise<void> {
    if (!confirm(t('Delete the application from {name}?', { name: a.name }))) {
      return;
    }
    try {
      await this.api.deleteApplication(a.id);
      this.applications.update((all) => all.filter((x) => x.id !== a.id));
      this.notify.info(t('Deleted.'));
    } catch (e) {
      this.notify.error((e as Error).message);
    }
  }

  async setHandled(m: ContactMessage, handled: boolean): Promise<void> {
    this.busyId.set(m.id);
    try {
      const saved = await this.api.setMessageHandled(m.id, handled);
      this.messages.update((all) => all.map((x) => (x.id === m.id ? saved : x)));
    } catch (e) {
      this.notify.error((e as Error).message);
    } finally {
      this.busyId.set(null);
    }
  }

  async removeMessage(m: ContactMessage): Promise<void> {
    if (!confirm(t('Delete the message from {name}?', { name: m.name }))) {
      return;
    }
    try {
      await this.api.deleteMessage(m.id);
      this.messages.update((all) => all.filter((x) => x.id !== m.id));
      this.notify.info(t('Deleted.'));
    } catch (e) {
      this.notify.error((e as Error).message);
    }
  }

  private async update(
    a: ApplicationRow,
    call: () => Promise<ApplicationRow>,
    done?: string,
  ): Promise<void> {
    this.busyId.set(a.id);
    try {
      const saved = await call();
      this.applications.update((all) => all.map((x) => (x.id === a.id ? saved : x)));
      if (done) {
        this.notify.success(done);
      }
    } catch (e) {
      this.notify.error((e as Error).message);
    } finally {
      this.busyId.set(null);
    }
  }
}
