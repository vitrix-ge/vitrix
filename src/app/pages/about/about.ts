import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PILLARS } from '../../site-data';
import { TPipe } from '../../content/i18n';

@Component({
  selector: 'app-about',
  imports: [RouterLink, TPipe],
  templateUrl: './about.html',
})
export class About {
  readonly pillars = PILLARS;
}
