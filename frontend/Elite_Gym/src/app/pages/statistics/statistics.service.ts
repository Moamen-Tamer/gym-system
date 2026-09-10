import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';

// Shape returned by GET /api/admin/statistics
export interface StatisticsResponse {
    totalMembers: number;
    activeSubscriptions: number;
    totalWorkouts: number;
    totalCalories: number;
    averageDuration: number;
    mostPopularWorkoutType: string;
}

@Injectable({
    providedIn: 'root',
})
export class StatisticsService {
    private readonly apiUrl = 'http://localhost:3000/api/admin/statistics';
    private readonly requestTimeoutMs = 8000;

    constructor(private http: HttpClient) { }

    getStatistics(): Observable<StatisticsResponse> {
        return this.http
            .get<StatisticsResponse>(this.apiUrl, { withCredentials: true })
            .pipe(timeout(this.requestTimeoutMs));
    }

    createMockData(): StatisticsResponse {
        return {
            totalMembers: 260,
            activeSubscriptions: 220,
            totalWorkouts: 13174,
            totalCalories: 6814906,
            averageDuration: 3908.55,
            mostPopularWorkoutType: 'strength',
        };
    }
}