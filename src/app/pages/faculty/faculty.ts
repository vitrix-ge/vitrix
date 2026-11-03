import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FACULTY } from '../../site-data';
import { TPipe } from '../../content/i18n';

@Component({
  selector: 'app-faculty',
  imports: [RouterLink, TPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './faculty.html',
})
export class Faculty {
  readonly faculty = FACULTY;
}
