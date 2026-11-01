import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PRIVACY_CONTACT_EMAIL } from '../../site-data';
import { lang } from '../../content/i18n';

@Component({
  selector: 'app-privacy',
  imports: [RouterLink],
  templateUrl: './privacy.html',
})
export class Privacy {
  readonly contactEmail = PRIVACY_CONTACT_EMAIL;
  readonly updated = '1 November 2026';
  readonly updatedKa = '1 ნოემბერი 2026';
  readonly lang = lang;
}
