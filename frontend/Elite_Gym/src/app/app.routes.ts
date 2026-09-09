import { Routes } from '@angular/router';
import { StatisticsComponent } from './statistics/statistics';

export const routes: Routes = [
  { path: '', redirectTo: 'statistics', pathMatch: 'full' },
  { path: 'statistics', component: StatisticsComponent },
  { path: '**', redirectTo: 'statistics' }
];
