import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { Auth } from '../auth';
import { CONTENT_API_URL } from './content.config';
import { t } from './i18n';
import {
  AnswerSubmission,
  AttemptResult,
  AttemptRow,
  AttemptStart,
  Course,
  CourseDetail,
  CourseSummary,
  Enrollment,
  Faq,
  Lesson,
  MyCourse,
  Question,
  Quiz,
} from './content.models';

/**
 * All calls to vitrix-api. Adds the login token when the member is signed in.
 * Errors are turned into readable messages (Error.message) for the pages to show.
 */
@Injectable({ providedIn: 'root' })
export class ContentApi {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);

  // ------------------------------------------------------------------ public
  courses(): Promise<CourseSummary[]> {
    return this.get('/api/courses');
  }
  course(slug: string): Promise<CourseDetail> {
    return this.get(`/api/courses/${encodeURIComponent(slug)}`);
  }
  faqs(): Promise<Faq[]> {
    return this.get('/api/faq');
  }

  // ------------------------------------------------------------------ student
  myCourses(): Promise<MyCourse[]> {
    return this.get('/api/me/courses');
  }
  myAttempts(): Promise<AttemptRow[]> {
    return this.get('/api/me/attempts');
  }
  completeLesson(lessonId: string): Promise<void> {
    return this.send('POST', `/api/lessons/${lessonId}/complete`);
  }
  startAttempt(quizId: string): Promise<AttemptStart> {
    return this.send('POST', `/api/quizzes/${quizId}/attempts`);
  }
  submitAttempt(attemptId: string, answers: AnswerSubmission[]): Promise<AttemptResult> {
    return this.send('POST', `/api/attempts/${attemptId}/submit`, { answers });
  }
  /** Removes my progress, results and enrollments (used when deleting the account). */
  deleteMyData(): Promise<void> {
    return this.send('DELETE', '/api/me');
  }

  // ------------------------------------------------------------------ staff (admin + editor)
  adminCourses(): Promise<Course[]> {
    return this.get('/api/admin/courses');
  }
  adminCourse(id: string): Promise<Course> {
    return this.get(`/api/admin/courses/${id}`);
  }
  saveCourse(course: Partial<Course>): Promise<Course> {
    return course.id
      ? this.send('PUT', `/api/admin/courses/${course.id}`, course)
      : this.send('POST', '/api/admin/courses', course);
  }
  deleteCourse(id: string): Promise<void> {
    return this.send('DELETE', `/api/admin/courses/${id}`);
  }

  adminLessons(courseId: string): Promise<Lesson[]> {
    return this.get(`/api/admin/courses/${courseId}/lessons`);
  }
  saveLesson(lesson: Partial<Lesson>): Promise<Lesson> {
    return lesson.id
      ? this.send('PUT', `/api/admin/lessons/${lesson.id}`, lesson)
      : this.send('POST', `/api/admin/courses/${lesson.courseId}/lessons`, lesson);
  }
  /** The lesson's quiz, created with lesson-quiz defaults the first time. */
  lessonQuiz(lessonId: string): Promise<Quiz> {
    return this.send('POST', `/api/admin/lessons/${lessonId}/quiz`);
  }
  deleteLesson(id: string): Promise<void> {
    return this.send('DELETE', `/api/admin/lessons/${id}`);
  }

  adminFaqs(): Promise<Faq[]> {
    return this.get('/api/admin/faq');
  }
  saveFaq(faq: Partial<Faq>): Promise<Faq> {
    return faq.id
      ? this.send('PUT', `/api/admin/faq/${faq.id}`, faq)
      : this.send('POST', '/api/admin/faq', faq);
  }
  deleteFaq(id: string): Promise<void> {
    return this.send('DELETE', `/api/admin/faq/${id}`);
  }

  adminQuizzes(courseId: string): Promise<Quiz[]> {
    return this.get(`/api/admin/courses/${courseId}/quizzes`);
  }
  adminQuiz(id: string): Promise<Quiz> {
    return this.get(`/api/admin/quizzes/${id}`);
  }
  saveQuiz(quiz: Partial<Quiz>): Promise<Quiz> {
    return quiz.id
      ? this.send('PUT', `/api/admin/quizzes/${quiz.id}`, quiz)
      : this.send('POST', `/api/admin/courses/${quiz.courseId}/quizzes`, quiz);
  }
  deleteQuiz(id: string): Promise<void> {
    return this.send('DELETE', `/api/admin/quizzes/${id}`);
  }

  adminQuestions(quizId: string): Promise<Question[]> {
    return this.get(`/api/admin/quizzes/${quizId}/questions`);
  }
  saveQuestion(question: Partial<Question>): Promise<Question> {
    return question.id
      ? this.send('PUT', `/api/admin/questions/${question.id}`, question)
      : this.send('POST', `/api/admin/quizzes/${question.quizId}/questions`, question);
  }
  deleteQuestion(id: string): Promise<void> {
    return this.send('DELETE', `/api/admin/questions/${id}`);
  }

  // ------------------------------------------------------------------ admin only
  enrollments(): Promise<Enrollment[]> {
    return this.get('/api/admin/enrollments');
  }
  enroll(courseId: string, email: string): Promise<Enrollment> {
    return this.send('POST', '/api/admin/enrollments', { courseId, email });
  }
  unenroll(id: string): Promise<void> {
    return this.send('DELETE', `/api/admin/enrollments/${id}`);
  }
  attempts(): Promise<AttemptRow[]> {
    return this.get('/api/admin/attempts');
  }

  // ------------------------------------------------------------------ plumbing
  private get<T>(path: string): Promise<T> {
    return this.run(this.http.get<T>(CONTENT_API_URL + path, { headers: this.headers() }));
  }

  private send<T>(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
    return this.run(
      this.http.request<T>(method, CONTENT_API_URL + path, { body, headers: this.headers() }),
    );
  }

  private headers(): HttpHeaders {
    const token = this.auth.accessToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  private async run<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw new Error(describe(error));
    }
  }
}

function describe(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return t('Something went wrong. Please try again.');
  }
  switch (error.status) {
    case 0:
      return t('The course server is not reachable. Please try again later.');
    case 401:
      return t('Please log in again.');
    case 403:
      return t('You do not have access to this.');
    case 404:
      return t('Not found. It may have been removed.');
  }
  const body = error.error as {
    errors?: string[] | Record<string, string[]>;
    title?: string;
  } | null;
  if (Array.isArray(body?.errors)) {
    return body.errors.map((e) => t(e)).join(' ');
  }
  if (body?.errors && typeof body.errors === 'object') {
    return Object.values(body.errors)
      .flat()
      .map((e) => t(e))
      .join(' ');
  }
  return body?.title ?? 'Something went wrong. Please try again.';
}
