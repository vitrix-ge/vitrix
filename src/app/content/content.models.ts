/**
 * Data exchanged with vitrix-api. Every text a visitor reads exists in English and Georgian.
 * Users are identified by the "sub" (id) and email from their identity-api login token.
 */

/** A text in both site languages. An empty string means "not translated yet". */
export interface LText {
  en: string;
  ka: string;
}

export interface CourseSummary {
  id: string;
  /** Used in the address: /courses/acls */
  slug: string;
  code: string;
  title: LText;
  summary: LText;
  /** Relative (media/acls.jpg) or absolute URL. */
  imageUrl: string;
  /** Price in GEL; null = not for sale yet / on request. */
  price: number | null;
  published: boolean;
  order: number;
}

export interface Course extends CourseSummary {
  description: LText;
}

export interface Lesson {
  id: string;
  courseId: string;
  order: number;
  title: LText;
  durationMinutes: number | null;
  /** Only sent to enrolled students and staff; empty in the public outline. */
  body: LText;
  /** YouTube video id (11 characters). Only sent to enrolled students and staff. */
  youtubeId: string | null;
  hasVideo: boolean;
  published: boolean;
  /** Student view only. */
  completed?: boolean;
  /** Student view: an earlier lesson isn't completed yet (body and video are withheld). */
  locked?: boolean;
  /** The lesson's quiz: passing it completes the lesson. */
  quizId?: string;
  quizQuestionCount?: number;
}

export interface Faq {
  id: string;
  /** null = general question (FAQ page); otherwise shown on that course's page. */
  courseId: string | null;
  order: number;
  question: LText;
  answer: LText;
  published: boolean;
}

export interface QuizSummary {
  id: string;
  courseId: string;
  title: LText;
  /** Score needed to pass, 0–100. */
  passPercent: number;
  /** 0 = unlimited. */
  maxAttempts: number;
  /** null = no time limit. */
  timeLimitMinutes: number | null;
  questionCount: number;
  published: boolean;
  /** Set for a lesson quiz; null for the course's final exam. */
  lessonId?: string | null;
  /** Student view only. */
  attemptsUsed?: number;
  bestScore?: number | null;
  passed?: boolean;
  /** Final exam, student view: opens once every lesson is completed. */
  locked?: boolean;
}

export interface Quiz extends QuizSummary {
  /** Shuffle question and answer order for each attempt. */
  shuffle: boolean;
  /** After submitting, show which answers were correct. */
  showCorrectAnswers: boolean;
}

export interface QuestionOption {
  id: string;
  text: LText;
  /** Only present in staff (admin/editor) responses — never sent to students before submitting. */
  correct?: boolean;
}

export interface Question {
  id: string;
  quizId: string;
  order: number;
  text: LText;
  /** true = several answers can be correct (checkboxes); false = exactly one (radio). */
  multiple: boolean;
  explanation: LText;
  options: QuestionOption[];
}

/** GET /api/courses/{slug} */
export interface CourseDetail {
  course: Course;
  lessons: Lesson[];
  faqs: Faq[];
  quizzes: QuizSummary[];
  /** The signed-in user may open lessons and tests (enrolled, or staff). */
  enrolled: boolean;
  /** Enrolled by email, but the member hasn't confirmed their email yet (lessons stay closed). */
  needsEmailConfirmation: boolean;
}

/** GET /api/me/courses */
export interface MyCourse {
  course: CourseSummary;
  lessonsTotal: number;
  lessonsCompleted: number;
  quizzesTotal: number;
  quizzesPassed: number;
}

/** POST /api/quizzes/{id}/attempts — starts an attempt. Options carry no "correct" flag. */
export interface AttemptStart {
  attemptId: string;
  quiz: QuizSummary;
  questions: Question[];
  startedAt: string;
  /** When the time limit runs out (ISO), or null. */
  expiresAt: string | null;
}

export interface AnswerSubmission {
  questionId: string;
  optionIds: string[];
}

export interface QuestionReview {
  questionId: string;
  correct: boolean;
  /** Empty unless the quiz shows correct answers. */
  correctOptionIds: string[];
  explanation: LText;
}

/** POST /api/attempts/{id}/submit */
export interface AttemptResult {
  attemptId: string;
  quizId: string;
  scorePercent: number;
  passed: boolean;
  correctCount: number;
  total: number;
  review: QuestionReview[];
}

/** GET /api/me/attempts and GET /api/admin/attempts */
export interface AttemptRow {
  id: string;
  quizId: string;
  quizTitle: LText;
  courseTitle: LText;
  userEmail: string;
  userName: string;
  submittedAt: string;
  scorePercent: number;
  passed: boolean;
}

/**
 * GET/POST /api/admin/enrollments. Enrollment is by email, so an admin can enrol someone before
 * they create their account; it applies as soon as they log in with that email.
 */
export interface Enrollment {
  id: string;
  courseId: string;
  courseTitle: LText;
  email: string;
  createdAt: string;
}

/** identity-api GET /api/admin/users — people and their staff roles (admin only). */
export interface StaffUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  createdAt: string;
}
