import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ReportMember {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  subscription_plan: string;
  subscription_status: string;
  allowed_workout_days: string[];
  created_at: string;
  updated_at: string;
}

export interface ReportWorkout {
  memberId: string;
  startTimestamp: string;
  endTimestamp: string | null;
  duration: number | null;
  workoutType: string;
  calories: number | null;
  feedback?: string | null;
  createdAt: string;
}

export interface ChartData {
  labels: string[];
  values: number[];
}

export interface ReportStats {
  totalWorkouts: number;
  totalCalories: number;
  averageDuration: number;
  mostActiveDay: string;
  leastActiveDay: string;
  chart: {
    byDay: ChartData;
    byType: ChartData;
  };
}

export interface MemberReport {
  member: ReportMember;
  workouts: ReportWorkout[];
  stats: ReportStats;
}

export interface ReportResponse {
  report: MemberReport;
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private http = inject(HttpClient);
  private readonly API_BASE = 'http://localhost:3000/api/reports';

  /** GET /api/reports/:memberId — admin auth required */
  getReport(memberId: string): Observable<ReportResponse> {
    return this.http.get<ReportResponse>(`${this.API_BASE}/${memberId}`, {
      withCredentials: true,
    });
  }

  /** GET /api/reports/:memberId/qr — returns { qrCode: string (base64 PNG) } */
  getQrCode(memberId: string): Observable<{ qrCode: string }> {
    return this.http.get<{ qrCode: string }>(`${this.API_BASE}/${memberId}/qr`, {
      withCredentials: true,
    });
  }

  /** URL to open the full printable HTML report in a new tab */
  getPrintUrl(memberId: string): string {
    return `${this.API_BASE}/${memberId}/print`;
  }
}