import z from "zod";

const fullName = z
    .string()
    .trim()
    .min(3, "full name must be 3-100 characters")
    .max(100, "full name must be 3-100 characters");

const email = z
    .string()
    .trim()
    .min(1, "email is required")
    .max(255, "email must be 255 characters or less")
    .email("invalid email address")
    .toLowerCase();

const password = z
    .string()
    .trim()
    .min(6, "password must be 6-255 characters")
    .max(255, "password must be 6-255 characters");

export const registerSchema = z.object({
    body: z.object({
        fullName,
        email,
        password
    }),
    query: z.unknown(),
    params: z.unknown()
});

export const loginSchema = z.object({
    body: z.object({
        email,
        password
    }),
    query: z.unknown(),
    params: z.unknown()
});

export const adminLoginSchema = z.object({
    body: z.object({
        email,
        password
    }),
    query: z.unknown(),
    params: z.unknown()
});