import { Routes } from '@angular/router';
import { MainLayout } from './layout/main-layout/main-layout';

export const dashboardRoutes: Routes = [
  {
    path: '',
    component: MainLayout,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        title: 'Dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard),
      },
      {
        path: 'members',
        title: 'Members',
        loadComponent: () => import('./pages/members/members').then(m => m.Members),
      },
      {
        path: 'workouts',
        title: 'Workouts',
        loadComponent: () => import('./pages/workouts/workouts').then(m => m.Workouts),
      },
      {
        path: 'history',
        title: 'History',
        loadComponent: () => import('./pages/history/history').then(m => m.History),
      },
      {
        path: 'statistics',
        title: 'Statistics',
        loadComponent: () => import('./pages/statistics/statistics').then(m => m.Statistics),
      },
      {
        path: 'reports',
        title: 'Reports',
        loadComponent: () => import('./pages/reports/reports').then(m => m.Reports),
      },
    ],
  },
];
