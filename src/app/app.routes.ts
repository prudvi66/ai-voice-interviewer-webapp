import { Routes } from '@angular/router';

export const routes: Routes = [
     { path: '', redirectTo: 'auth', pathMatch: 'full' },
  { path: 'auth', loadComponent: () => import('./auth/auth').then(m => m.Auth) },
  { path: 'resume-upload', loadComponent: () => import('./resume-upload/resume-upload').then(m => m.ResumeUpload) },
  { path: 'interview-schedule', loadComponent: () => import('./interview-schedule/interview-schedule').then(m => m.InterviewSchedule) },
  { path: 'interview', loadComponent: () => import('./interview/interview').then(m => m.Interview) },
  { path: 'results', loadComponent: () => import('./results/results').then(m => m.Results) },
  { path: '**', redirectTo: 'auth' }
];
