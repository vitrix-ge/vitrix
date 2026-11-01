import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PRIVACY_CONTACT_EMAIL } from '../../site-data';

@Component({
  selector: 'app-privacy',
  imports: [RouterLink],
  templateUrl: './privacy.html',
})
export class Privacy {
  readonly contactEmail = PRIVACY_CONTACT_EMAIL;
  readonly updated = '1 November 2026';
}
