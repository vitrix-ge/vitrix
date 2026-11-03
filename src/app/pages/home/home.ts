import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { COURSES, PILLARS, STATS } from '../../site-data';
import { Mark } from '../../mark';
import { TPipe } from '../../content/i18n';

@Component({
  selector: 'app-home',
  imports: [RouterLink, Mark, TPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './home.html',
})
export class Home {
  readonly pillars = PILLARS;
  readonly stats = STATS;
  readonly courses = COURSES;
}
