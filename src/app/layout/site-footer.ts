import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FOOTER_NAV } from '../site-data';
import { Mark } from '../mark';
import { TPipe } from '../content/i18n';

@Component({
  selector: 'app-site-footer',
  imports: [RouterLink, Mark, TPipe],
  templateUrl: './site-footer.html',
})
export class SiteFooter {
  readonly nav = FOOTER_NAV;
  readonly year = new Date().getFullYear();
}
