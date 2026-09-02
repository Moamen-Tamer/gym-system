import { HttpError } from "../errors/HttpError.js";
import { existsByEmail, signUp, signInWithPassword, refreshSupabaseSession, revokeSession, deleteAuthUser } from "../repositories/auth.js";
import { fetchMemberById } from "../repositories/members.js";
import type { LoginResult, refreshResult } from "../types/blueprints.js";

export const register = async (
    fullName: string, 
    email: string, 
    password: string
): Promise<void> => {
    const emailExists: boolean = await existsByEmail(email);

    if (emailExists) throw new HttpError(409, "Email is already registered.");

    const { user, error } = await signUp(fullName, email, password);

    if (error) throw new HttpError(409, error.message);

    if (user?.identities && user.identities.length === 0) throw new HttpError(409, "Email is already registered.");
};

export const login = async (
    email: string, 
    password: string
): Promise<LoginResult> => {
    const { user, session, error } = await signInWithPassword(email, password);

    if (error || !user || !session) throw new HttpError(401, "Invalid email or password.");

    const member = await fetchMemberById(user.id);

    if (!member) throw new HttpError(401, "Invalid email or password.");

    return {
        user: {
            id: member.id,
            full_name: member.full_name,
            email: member.email,
            phone: member.phone,
            subscription_plan: member.subscription_plan,
            subscription_status: member.subscription_status,
            allowed_workout_days: member.allowed_workout_days,
            created_at: member.created_at,
            updated_at: member.updated_at
        },
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresIn: session.expires_in
    };
};

export const logout = async (accessToken: string): Promise<void> => {
    if (!accessToken) return;

    await revokeSession(accessToken);
};

export const refreshSession = async (refreshToken: string): Promise<refreshResult> => {
    if (!refreshToken) throw new HttpError(401, "Refresh token required.");

    const { session, error } = await refreshSupabaseSession(refreshToken);

    if (error || !session) throw new HttpError(401, "Invalid or expired refresh token.");

    return {
        accessToken: session?.access_token,
        refreshToken: session?.refresh_token,
        expiresIn: session?.expires_in
    };
};

export const deleteAccount = async (userId: string): Promise<void> => {
    await deleteAuthUser(userId);
};
