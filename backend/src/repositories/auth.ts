import { supabase, supabaseAuth } from "../connections/supabase.js";
import { AuthError, type Session, type User as supabaseUser } from "@supabase/supabase-js";
import { HttpError } from "../errors/HttpError.js";

export const existsByEmail = async (
    email: string
): Promise<boolean> => {
    const { data, error } = await supabase
        .from("members")
        .select("id")
        .eq("email", email)
        .maybeSingle();

    if (error) throw new HttpError(500, error.message);

    return data !== null;
};

export const signUp = async (
    fullName: string,
    email: string,
    password: string
): Promise<{ user: supabaseUser | null; error: AuthError | null }> => {
    const { data, error } = await supabaseAuth.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName
            }
        }
    })

    return { user: data.user, error };
};

export const signInWithPassword = async (
    email: string,
    password: string
): Promise<{ user: supabaseUser | null; session: Session | null; error: AuthError | null }> => {
    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });

    return { user: data.user, session: data.session, error };
};

export const getSupabaseUser = async (
    accessToken: string
): Promise<{ user: supabaseUser | null; error: AuthError | null }> => {
    const { data, error } = await supabaseAuth.auth.getUser(accessToken);

    return { user: data.user, error };
};

export const refreshSupabaseSession = async (
    refreshToken: string
): Promise<{ session: Session | null; error: AuthError | null }> => {
    const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token: refreshToken });

    return { session: data.session, error };
};

export const revokeSession = async (
    accessToken: string
): Promise<{ error: AuthError | null }> => {
    const { error } = await supabase.auth.admin.signOut(accessToken, "local");

    return { error };
};

export const deleteAuthUser = async (
    userId: string
) => {
    const { error } = await supabase.auth.admin.deleteUser(userId);

    return { error };
};
