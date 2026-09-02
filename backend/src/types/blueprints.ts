export interface Payload {
    id: string;
    fullName: string;
    email: string;
    role: "member" | "admin";
};

export interface Member {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    subscription_plan: string;
    subscription_status: string;
    allowed_workout_days: string[];
    created_at: string;
    updated_at: string;
};

export interface LoginResult {
    user: Member;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
};

export interface refreshResult {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
};

export interface Workout {
    memberId: string;
    startTimestamp: Date;
    endTimestamp: Date | null;
    duration: number | null;
    workoutType: string;
    calories: number | null;
    feedback?: string | null;
    createdAt: Date;
};

export interface ChartData {
    labels: string[];
    values: number[];
};

export interface DashboardChart {
    byDay: ChartData;
    byType: ChartData;
};

export interface DashboardStats {
    totalWorkouts: number;
    totalCalories: number;
    averageDuration: number;
    mostActiveDay: string;
    leastActiveDay: string;
    chart: DashboardChart;
};

export interface GymStatistics {
    totalMembers: number;
    activeSubscriptions: number;
    totalWorkouts: number;
    totalCalories: number;
    averageDuration: number;
    mostPopularWorkoutType: string;
};

export interface MemberReport {
    member: Member;
    workouts: Workout[];
    stats: DashboardStats;
};