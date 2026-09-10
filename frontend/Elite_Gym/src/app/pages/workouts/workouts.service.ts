import { Injectable } from '@angular/core';

export type WorkoutType =
    | 'strength'
    | 'cardio'
    | 'flexibility'
    | 'hiit'
    | 'crossfit'
    | 'yoga'
    | 'other';

export interface Workout {
    _id?: string;
    id?: string;
    memberId?: string;
    startTimestamp: string;
    endTimestamp: string | null;
    duration: number | null;
    workoutType: WorkoutType;
    calories: number | null;
    feedback?: string | null;
    createdAt?: string;
}

export interface HistoryResponse {
    workouts: Workout[];
    total: number;
    page: number;
    limit: number;
}

@Injectable({ providedIn: 'root' })
export class WorkoutService {
    private readonly apiBaseUrl = 'http://localhost:3000/api';

    private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
        const response = await fetch(`${this.apiBaseUrl}${url}`, {
            ...options,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers ?? {})
            }
        });

        const contentType = response.headers.get('content-type') ?? '';
        const data = contentType.includes('application/json')
            ? await response.json()
            : await response.text();

        if (!response.ok) {
            const message =
                typeof data === 'object' && data?.message
                    ? data.message
                    : `Request failed (${response.status})`;
            throw new Error(message);
        }

        return data as T;
    }

    getActiveWorkout() {
        return this.request<{ workout: Workout | null }>('/workouts/active');
    }

    startWorkout(workoutType: WorkoutType) {
        return this.request<{ message: string; workout: Workout }>('/workouts/start', {
            method: 'POST',
            body: JSON.stringify({ workoutType })
        });
    }

    stopWorkout(id: string, calories?: number) {
        return this.request<{ message: string; workout: Workout }>(`/workouts/${id}/stop`, {
            method: 'POST',
            body: JSON.stringify(
                calories === undefined ? {} : { calories }
            )
        });
    }

    submitFeedback(id: string, feedback: string) {
        return this.request<{ message: string; workout: { id: string; feedback: string } }>(
            `/workouts/${id}/feedback`,
            {
                method: 'PATCH',
                body: JSON.stringify({ feedback })
            }
        );
    }

    getHistory(page = 1, limit = 10, workoutType?: WorkoutType) {
        const params = new URLSearchParams({
            page: String(page),
            limit: String(limit)
        });

        if (workoutType) {
            params.set('workoutType', workoutType);
        }

        return this.request<HistoryResponse>(`/workouts/history?${params.toString()}`);
    }
}