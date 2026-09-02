import { HttpError } from "../errors/HttpError.js";
import { fetchMemberById, fetchAllMembers, countMembers, insertMember, updateMember, deleteMember, changeSubscription } from "../repositories/members.js";
import { deleteAuthUser, existsByEmail, signUp } from "../repositories/auth.js";
import { invalidateMemberCache, invalidateDashboardCache, invalidateReportCache } from "../repositories/cache.js";
import Workout from "../models/workout.model.js";
import type { Member } from "../types/blueprints.js";

export const getAccount = async (memberId: string): Promise<Member> => {
    const member = await fetchMemberById(memberId);

    if (!member) throw new HttpError(404, "Member not found.");

    return member;
};

export const getSubscription = async (memberId: string): Promise<Member> => {
    const member = await fetchMemberById(memberId);

    if (!member) throw new HttpError(404, "Member not found.");

    return member;
};

export const getWorkoutDays = async (memberId: string): Promise<string[]> => {
    const member = await fetchMemberById(memberId);

    if (!member) throw new HttpError(404, "Member not found.");

    return member.allowed_workout_days;
};

export const listMembers = async (page: number, limit: number) => {
    const [members, total] = await Promise.all([
        fetchAllMembers(page, limit),
        countMembers()
    ]);

    return { members, total };
};

export const createMember = async (
    fullName: string,
    email: string,
    phone: string | null,
    subscriptionPlan: string,
    password: string
): Promise<Member> => {
    const emailExists: boolean = await existsByEmail(email);

    if (emailExists) throw new HttpError(409, "Email is already registered.");

    const { user, error } = await signUp(fullName, email, password);

    if (error) throw new HttpError(409, error.message);

    if (!user) throw new HttpError(500, "Failed to create auth user.");

    const members = await insertMember(user.id, fullName, email, phone, subscriptionPlan);
    const member = members[0];

    if (!member) throw new HttpError(500, "Failed to create member.");

    return member;
};

export const updateMemberById = async (
    memberId: string,
    update: { full_name?: string; phone?: string | null; subscription_plan?: string }
): Promise<Member> => {
    const member = await fetchMemberById(memberId);

    if (!member) throw new HttpError(404, "Member not found.");

    const members = await updateMember(memberId, update);
    const updated = members[0];

    if (!updated) throw new HttpError(500, "Failed to update member.");

    await invalidateMemberCache(memberId);
    await invalidateDashboardCache(memberId);
    await invalidateReportCache(memberId);

    return updated;
};

export const changeMemberSubscription = async (
    memberId: string,
    newPlan: string
): Promise<Member> => {
    const member = await fetchMemberById(memberId);

    if (!member) throw new HttpError(404, "Member not found.");

    const members = await changeSubscription(memberId, newPlan);
    const updated = members[0];

    if (!updated) throw new HttpError(500, "Failed to change subscription.");

    await invalidateMemberCache(memberId);
    await invalidateDashboardCache(memberId);
    await invalidateReportCache(memberId);

    return updated;
};

export const deleteMemberById = async (memberId: string): Promise<void> => {
    const member = await fetchMemberById(memberId);

    if (!member) throw new HttpError(404, "Member not found.");

    await Promise.all([
        Workout.deleteMany({ memberId }),
        deleteAuthUser(memberId),
        deleteMember(memberId),
        invalidateMemberCache(memberId),
        invalidateDashboardCache(memberId),
        invalidateReportCache(memberId)
    ]);
};
