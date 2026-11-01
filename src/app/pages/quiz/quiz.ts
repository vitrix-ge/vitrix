import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { QuizRunner } from './quiz-runner';
import { TPipe } from '../../content/i18n';

/** /tests/:id — a course's final exam (lesson quizzes run inline on the course page). */
@Component({
  selector: 'app-quiz',
  imports: [QuizRunner, TPipe],
  templateUrl: './quiz.html',
})
export class QuizPage {
  private readonly router = inject(Router);
  readonly quizId = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  backToCourse(): void {
    history.length > 1 ? history.back() : void this.router.navigateByUrl('/account');
  }
}
