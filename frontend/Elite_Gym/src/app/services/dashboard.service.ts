import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ChartData {
  labels: string[];
  values: number[];
}

export interface DashboardChart {
  byDay: ChartData;
  byType: ChartData;
}

export interface DashboardStats {
  totalWorkouts: number;
  totalCalories: number;
  averageDuration: number; // seconds
  mostActiveDay: string;
  leastActiveDay: string;
  chart: DashboardChart;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private readonly API_BASE = 'http://localhost:3000/api/dashboard';

  /** GET /api/dashboard — member must be authenticated (accessToken cookie) */
  getDashboard(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(this.API_BASE, {
      withCredentials: true,
    });
  }
}