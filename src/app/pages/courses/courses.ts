import { afterNextRender, Component, inject, Injector } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Catalog } from '../../content/catalog';
import { TPipe, TrPipe } from '../../content/i18n';

@Component({
  selector: 'app-courses',
  imports: [RouterLink, TrPipe, TPipe],
  templateUrl: './courses.html',
})
export class Courses {
  private readonly catalog = inject(Catalog);
  readonly courses = this.catalog.courses;
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);

  constructor() {
    void this.catalog.load();
    this.route.fragment.pipe(takeUntilDestroyed()).subscribe((fragment) => {
      if (!fragment) {
        return;
      }
      afterNextRender(
        () => {
          const section = document.getElementById(fragment);
          if (!section) {
            return;
          }
          const top = section.getBoundingClientRect().top + window.scrollY - 90;
          window.scrollTo({ top });
        },
        { injector: this.injector },
      );
    });
  }
}
