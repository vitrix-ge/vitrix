import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PRIVACY_CONTACT_EMAIL } from '../../site-data';
import { lang } from '../../content/i18n';

/** /terms — Terms of service, full Georgian and English versions (like the privacy page). */
@Component({
  selector: 'app-terms',
  imports: [RouterLink],
  templateUrl: './terms.html',
})
export class Terms {
  readonly contactEmail = PRIVACY_CONTACT_EMAIL;
  readonly updated = '3 November 2026';
  readonly updatedKa = '3 ნოემბერი 2026';
  readonly lang = lang;
}
