import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PARTNERS } from '../../site-data';
import { TPipe } from '../../content/i18n';

@Component({
  selector: 'app-partners',
  imports: [RouterLink, TPipe],
  templateUrl: './partners.html',
})
export class Partners {
  readonly partners = PARTNERS;
}
