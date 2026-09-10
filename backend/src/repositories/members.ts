import { supabase } from "../connections/supabase.js";
import { PLAN_WORKOUT_DAYS, type Member } from "../types/blueprints.js";
import { HttpError } from "../errors/HttpError.js";

export const getWorkoutDaysForPlan = (plan: string): string[] => {
    const days = PLAN_WORKOUT_DAYS[plan];

    return days ?? ["monday", "wednesday", "friday"];
};

export const fetchMemberById = async (
    memberId: string
) => {
    const { data, error } = await supabase
        .from("members")
        .select("id, full_name, email, phone, subscription_plan, subscription_status, allowed_workout_days, created_at, updated_at")
        .eq("id", memberId)
        .maybeSingle();

    if (error) throw new HttpError(500, "Failed to fetch member");

    if (!data) return undefined;

    return {
        ...data,
        allowed_workout_days: data.allowed_workout_days ?? []
    } as Member;
};

export const fetchAllMembers = async (
    page: number,
    limit: number,
    search?: string,
    filter?: string
) => {
    const offset = (page - 1) * limit;

    let query = supabase
        .from("members")
        .select("id, full_name, email, phone, subscription_plan, subscription_status, allowed_workout_days, created_at, updated_at");

    if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    if (filter) {
        if (filter === 'elite') query = query.eq('subscription_plan', 'premium');
        else if (filter === 'pro') query = query.eq('subscription_plan', 'standard');
        else if (filter === 'basic') query = query.eq('subscription_plan', 'basic');
        else if (filter === 'expiring') query = query.in('subscription_status', ['expiring', 'expired']);
    }

    const { data, error } = await query
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) throw new HttpError(500, "Failed to fetch members");

    return ((data ?? []) as unknown as Member[]).map(m => ({
        ...m,
        allowed_workout_days: m.allowed_workout_days ?? []
    }));
};

export const countMembers = async (search?: string, filter?: string): Promise<number> => {
    let query = supabase
        .from("members")
        .select("*", { count: "exact", head: true });

    if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    if (filter) {
        if (filter === 'elite') query = query.eq('subscription_plan', 'premium');
        else if (filter === 'pro') query = query.eq('subscription_plan', 'standard');
        else if (filter === 'basic') query = query.eq('subscription_plan', 'basic');
        else if (filter === 'expiring') query = query.in('subscription_status', ['expiring', 'expired']);
    }

    const { count, error } = await query;

    if (error) throw new HttpError(500, "Failed to count members");

    return count ?? 0;
};

export const updateMemberAfterSignup = async (
    id: string,
    phone: string | null,
    subscriptionPlan: string
): Promise<Member | null> => {
    const workoutDays = getWorkoutDaysForPlan(subscriptionPlan);

    const { data, error } = await supabase
        .from("members")
        .update({
            phone,
            subscription_plan: subscriptionPlan,
            allowed_workout_days: workoutDays
        })
        .eq("id", id)
        .select(
            "id, full_name, email, phone, subscription_plan, subscription_status, allowed_workout_days, created_at, updated_at"
        )
        .single();

    if (error) throw new HttpError(500, "Failed to create member");

    return {
        ...data,
        allowed_workout_days: data.allowed_workout_days ?? []
    } as Member;
};

export const updateMember = async (
    memberId: string,
    update: { full_name?: string; phone?: string | null; subscription_plan?: string }
): Promise<Member[]> => {
    const fields: Record<string, unknown> = {};

    if (update.full_name !== undefined) fields.full_name = update.full_name;
    if (update.phone !== undefined) fields.phone = update.phone;
    if (update.subscription_plan !== undefined) {
        fields.subscription_plan = update.subscription_plan;
        fields.allowed_workout_days = getWorkoutDaysForPlan(update.subscription_plan);
    }

    const { data, error } = await supabase
        .from("members")
        .update(fields)
        .eq("id", memberId)
        .select("id, full_name, email, phone, subscription_plan, subscription_status, allowed_workout_days, created_at, updated_at");

    if (error) throw new HttpError(500, "Failed to update member");

    return ((data ?? []) as unknown as Member[]).map(m => ({
        ...m,
        allowed_workout_days: m.allowed_workout_days ?? []
    }));
};

export const deleteMember = async (
    memberId: string
): Promise<void> => {
    const { error } = await supabase
        .from("members")
        .delete()
        .eq("id", memberId);

    if (error) throw new HttpError(500, "Failed to delete member");
};

export const changeSubscription = async (
    memberId: string,
    newPlan: string
): Promise<Member[]> => {
    const workoutDays = getWorkoutDaysForPlan(newPlan);

    const { data, error } = await supabase
        .from("members")
        .update({
            subscription_plan: newPlan,
            allowed_workout_days: workoutDays
        })
        .eq("id", memberId)
        .select("id, full_name, email, phone, subscription_plan, subscription_status, allowed_workout_days, created_at, updated_at");

    if (error) throw new HttpError(500, "Failed to change subscription");

    return ((data ?? []) as unknown as Member[]).map(m => ({
        ...m,
        allowed_workout_days: m.allowed_workout_days ?? []
    }));
};

export const countActiveSubscriptions = async (): Promise<number> => {
    const { count, error } = await supabase
        .from("members")
        .select("*", { count: "exact", head: true })
        .eq("subscription_status", "active");

    if (error) throw new HttpError(500, "Failed to count active subscriptions");

    return count ?? 0;
};
