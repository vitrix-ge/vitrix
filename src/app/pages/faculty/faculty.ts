import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FACULTY } from '../../site-data';
import { TPipe } from '../../content/i18n';

@Component({
  selector: 'app-faculty',
  imports: [RouterLink, TPipe],
  templateUrl: './faculty.html',
})
export class Faculty {
  readonly faculty = FACULTY;
}
