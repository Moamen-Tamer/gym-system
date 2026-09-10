import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'auth', title: 'auth', loadChildren: () => import('../pages/auth/auth.routes').then(m => m.routes) },
  { path: '', loadChildren: () => import('./dashboard.routes').then(m => m.dashboardRoutes) },
  { path: '**', redirectTo: '/dashboard' },
];

