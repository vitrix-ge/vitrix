import { Routes } from '@angular/router';
import { authGuard } from './auth';
import { roleGuard } from './content/roles';

export const routes: Routes = [
  {
    path: '',
    data: { title: 'Home' },
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
  },
  {
    path: 'about',
    data: { title: 'About' },
    loadComponent: () => import('./pages/about/about').then((m) => m.About),
  },
  {
    path: 'courses',
    data: { title: 'Courses' },
    loadComponent: () => import('./pages/courses/courses').then((m) => m.Courses),
  },
  {
    path: 'simulation',
    data: { title: 'Simulation' },
    loadComponent: () => import('./pages/simulation/simulation').then((m) => m.Simulation),
  },
  {
    path: 'faculty',
    data: { title: 'Faculty' },
    loadComponent: () => import('./pages/faculty/faculty').then((m) => m.Faculty),
  },
  {
    path: 'partners',
    data: { title: 'Partners' },
    loadComponent: () => import('./pages/partners/partners').then((m) => m.Partners),
  },
  {
    path: 'contact',
    data: { title: 'Contact' },
    loadComponent: () => import('./pages/contact/contact').then((m) => m.Contact),
  },
  {
    path: 'apply',
    data: { title: 'Apply' },
    canActivate: [authGuard],
    loadComponent: () => import('./pages/apply/apply').then((m) => m.Apply),
  },
  {
    path: 'login',
    data: { title: 'Log in' },
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'confirm-email',
    data: { title: 'Confirm email' },
    loadComponent: () => import('./pages/confirm-email/confirm-email').then((m) => m.ConfirmEmail),
  },
  {
    path: 'reset-password',
    data: { title: 'New password' },
    loadComponent: () =>
      import('./pages/reset-password/reset-password').then((m) => m.ResetPassword),
  },
  {
    path: 'account',
    data: { title: 'My account' },
    canActivate: [authGuard],
    loadComponent: () => import('./pages/account/account').then((m) => m.Account),
  },
  {
    path: 'courses/:slug',
    data: { title: 'Course' },
    loadComponent: () => import('./pages/course/course').then((m) => m.CoursePage),
  },
  {
    path: 'tests/:id',
    data: { title: 'Test' },
    canActivate: [authGuard],
    loadComponent: () => import('./pages/quiz/quiz').then((m) => m.QuizPage),
  },
  {
    path: 'certificates',
    data: { title: 'Certificates' },
    loadComponent: () => import('./pages/certificate/certificate').then((m) => m.CertificatePage),
  },
  {
    path: 'certificates/:code',
    data: { title: 'Certificate' },
    loadComponent: () => import('./pages/certificate/certificate').then((m) => m.CertificatePage),
  },
  {
    path: 'faq',
    data: { title: 'Questions & answers' },
    loadComponent: () => import('./pages/faq/faq').then((m) => m.FaqPage),
  },
  {
    path: 'admin',
    canActivate: [roleGuard('admin', 'editor')],
    loadChildren: () => import('./pages/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: 'privacy',
    data: { title: 'Privacy' },
    loadComponent: () => import('./pages/privacy/privacy').then((m) => m.Privacy),
  },
  { path: '**', redirectTo: '' },
];
