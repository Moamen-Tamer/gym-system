export type SubscriptionLevel = 'Elite' | 'Pro' | 'Basic';
export type MemberStatus = 'Active' | 'Expiring' | 'Expired';

export interface Member {
    id: string;
    name: string;
    memberCode: string;        // e.g. #88392A, shown under the name
    avatarUrl?: string | null;
    subscriptionLevel: SubscriptionLevel;
    status: MemberStatus;
    expiresInDays?: number | null; // used when status === 'Expiring'
    lastWorkoutAt?: string | null; // ISO date string, null => never worked out
    phone?: string;
}

export interface PaginatedMembersResponse {
    data: Member[];
    total: number;
    page: number;
    limit: number;
}

export interface AdminStatistics {
    totalActiveMembers: number;
    expiringSubscriptionsThisWeek: number;
    eliteTierConversionPercent: number;
}

export type MemberFilter = 'all' | 'elite' | 'pro' | 'expiring';