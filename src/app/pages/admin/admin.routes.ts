import { Routes } from '@angular/router';
import { roleGuard } from '../../content/roles';

/** /admin — staff area. Editors manage content; admins also manage students and see results. */
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./shell').then((m) => m.AdminShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'courses' },
      {
        path: 'courses',
        data: { title: 'Admin · Courses' },
        loadComponent: () => import('./courses').then((m) => m.AdminCourses),
      },
      {
        path: 'courses/:id',
        data: { title: 'Admin · Edit course' },
        loadComponent: () => import('./course-edit').then((m) => m.AdminCourseEdit),
      },
      {
        path: 'tests/:id',
        data: { title: 'Admin · Edit test' },
        loadComponent: () => import('./quiz-edit').then((m) => m.AdminQuizEdit),
      },
      {
        path: 'faq',
        data: { title: 'Admin · Q&A' },
        loadComponent: () => import('./faq').then((m) => m.AdminFaq),
      },
      {
        path: 'students',
        data: { title: 'Admin · Students' },
        canActivate: [roleGuard('admin')],
        loadComponent: () => import('./students').then((m) => m.AdminStudents),
      },
      {
        path: 'applications',
        data: { title: 'Admin · Applications' },
        canActivate: [roleGuard('admin')],
        loadComponent: () => import('./applications').then((m) => m.AdminApplications),
      },
      {
        path: 'team',
        data: { title: 'Admin · Team' },
        canActivate: [roleGuard('admin')],
        loadComponent: () => import('./team').then((m) => m.AdminTeam),
      },
      {
        path: 'results',
        data: { title: 'Admin · Results' },
        canActivate: [roleGuard('admin')],
        loadComponent: () => import('./results').then((m) => m.AdminResults),
      },
    ],
  },
];
