import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
    AdminStatistics,
    Member,
    MemberFilter,
    PaginatedMembersResponse,
} from './members-model';

const API_BASE = 'http://localhost:3000/api';

/** Shape returned by the backend GET /api/admin/members */
interface BackendMember {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    subscription_plan: string;   // 'basic' | 'standard' | 'premium'
    subscription_status: string; // 'active' | 'inactive' | ...
    allowed_workout_days: string[];
    created_at: string;
    updated_at: string;
}

/** Shape returned by GET /api/admin/statistics */
interface BackendStatistics {
    totalMembers: number;
    activeSubscriptions: number;
    totalWorkouts: number;
    totalCalories: number;
    averageDuration: number;
    mostPopularWorkoutType: string;
}

function planToLevel(plan: string): Member['subscriptionLevel'] {
    switch (plan?.toLowerCase()) {
        case 'premium': return 'Elite';
        case 'standard': return 'Pro';
        default: return 'Basic';
    }
}

function levelToPlan(level: Member['subscriptionLevel']): string {
    switch (level) {
        case 'Elite': return 'premium';
        case 'Pro': return 'standard';
        default: return 'basic';
    }
}

function statusToFrontend(status: string): Member['status'] {
    return status === 'active' ? 'Active' : 'Expired';
}

function mapBackendMember(m: BackendMember): Member {
    return {
        id: m.id,
        name: m.full_name,
        memberCode: '#' + m.id.replace(/-/g, '').slice(0, 6).toUpperCase(),
        subscriptionLevel: planToLevel(m.subscription_plan),
        status: statusToFrontend(m.subscription_status),
        phone: m.phone ?? '',
        lastWorkoutAt: null,
        expiresInDays: null,
    };
}

export interface GetMembersOptions {
    page?: number;
    limit?: number;
    search?: string;
    filter?: MemberFilter;
}

@Injectable({ providedIn: 'root' })
export class MemberService {
    constructor(private http: HttpClient) { }

    getMembers(options: GetMembersOptions = {}): Observable<PaginatedMembersResponse> {
        let params = new HttpParams()
            .set('page', String(options.page ?? 1))
            .set('limit', String(options.limit ?? 10));

        if (options.search) {
            params = params.set('search', options.search);
        }
        if (options.filter && options.filter !== 'all') {
            params = params.set('filter', options.filter);
        }

        return this.http
            .get<{ members: BackendMember[]; total: number; page: number; limit: number }>(
                `${API_BASE}/admin/members`,
                { params, withCredentials: true }
            )
            .pipe(
                map(res => ({
                    data: (res.members ?? []).map(mapBackendMember),
                    total: res.total,
                    page: res.page,
                    limit: res.limit,
                }))
            );
    }

    getStatistics(): Observable<AdminStatistics> {
        return this.http
            .get<BackendStatistics>(`${API_BASE}/admin/statistics`, { withCredentials: true })
            .pipe(
                map(s => ({
                    totalActiveMembers: s.activeSubscriptions,
                    expiringSubscriptionsThisWeek: 0,
                    eliteTierConversionPercent: s.totalMembers > 0
                        ? Math.round((s.activeSubscriptions / s.totalMembers) * 100)
                        : 0,
                }))
            );
    }

    addMember(payload: { name: string; email: string; phone: string; subscriptionLevel: Member['subscriptionLevel'] }): Observable<Member> {
        const body = {
            fullName: payload.name,
            email: payload.email,
            phone: payload.phone || null,
            subscriptionPlan: levelToPlan(payload.subscriptionLevel),
            password: 'Gym@' + Math.random().toString(36).slice(2, 10) + '!1',
        };
        return this.http
            .post<{ member: BackendMember }>(`${API_BASE}/admin/members`, body, { withCredentials: true })
            .pipe(map(res => mapBackendMember(res.member)));
    }

    updateMember(id: string, payload: { name?: string; phone?: string }): Observable<Member> {
        const body: Record<string, string | null | undefined> = {};
        if (payload.name !== undefined) body['fullName'] = payload.name;
        if (payload.phone !== undefined) body['phone'] = payload.phone || null;
        return this.http
            .put<{ member: BackendMember }>(`${API_BASE}/admin/members/${id}`, body, { withCredentials: true })
            .pipe(map(res => mapBackendMember(res.member)));
    }

    changeSubscription(id: string, subscriptionLevel: Member['subscriptionLevel']): Observable<Member> {
        return this.http
            .patch<{ member: BackendMember }>(
                `${API_BASE}/admin/members/${id}/subscription`,
                { subscriptionPlan: levelToPlan(subscriptionLevel) },
                { withCredentials: true }
            )
            .pipe(map(res => mapBackendMember(res.member)));
    }

    deleteMember(id: string): Observable<void> {
        return this.http.delete<void>(`${API_BASE}/admin/members/${id}`, { withCredentials: true });
    }
}