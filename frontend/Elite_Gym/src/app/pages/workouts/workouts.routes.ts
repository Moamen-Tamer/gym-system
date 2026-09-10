import { Routes } from '@angular/router';
import { WorkoutsComponent } from './workouts';
import { HistoryComponent } from '../history/history';

export const WORKOUT_ROUTES: Routes = [
    {
        path: 'workouts',
        component: WorkoutsComponent
    },
    {
        path: 'history',
        component: HistoryComponent
    }
];