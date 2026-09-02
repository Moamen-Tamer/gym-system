import { env } from "./env.js";

const baseCookieOptions = {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "strict" as const
}

export const accessCookieOptions = (expiresInSeconds: number) => ({
    ...baseCookieOptions,
    maxAge: expiresInSeconds * 1000
});

export const refreshCookieOptions = {
    ...baseCookieOptions,
    maxAge: 1000 * 60 * 60 * 24 * 30
};