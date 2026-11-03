import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PRIVACY_CONTACT_EMAIL } from '../../site-data';
import { lang } from '../../content/i18n';

/** /refunds — Refund and cancellation policy, full Georgian and English versions (like the privacy page). */
@Component({
  selector: 'app-refunds',
  imports: [RouterLink],
  templateUrl: './refunds.html',
})
export class Refunds {
  readonly contactEmail = PRIVACY_CONTACT_EMAIL;
  readonly updated = '3 November 2026';
  readonly updatedKa = '3 ნოემბერი 2026';
  readonly lang = lang;
}
