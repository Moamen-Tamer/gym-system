import z from "zod";
import { uuid } from "./common.js";

const fullName = z
    .string()
    .trim()
    .min(3, "full name must be 3-100 characters")
    .max(100, "full name must be 3-100 characters");

const phone = z
    .string()
    .trim()
    .regex(/^01\d{9}$/, "invalid phone number")
    .nullable()
    .optional();

const subscriptionPlan = z
    .enum(["basic", "standard", "premium"], {
        message: "subscription plan must be basic, standard, or premium"
    });

export const memberIdSchema = z.object({
    body: z.unknown(),
    query: z.unknown(),
    params: z.object({
        id: uuid("member")
    })
});

export const createMemberSchema = z.object({
    body: z.object({
        fullName,
        email: z.string().trim().min(1, "email is required").max(255, "email must be 255 characters or less").email("invalid email address").toLowerCase(),
        phone: phone.default(null),
        subscriptionPlan: subscriptionPlan.default("basic"),
        password: z.string().trim().min(6, "password must be 6-255 characters").max(255, "password must be 6-255 characters")
    }),
    query: z.unknown(),
    params: z.unknown()
});

export const listMembersQuerySchema = z.object({
    body: z.unknown(),

    query: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(20)
    }),

    params: z.unknown()
});

export const updateMemberSchema = z.object({
    body: z.object({
        fullName: fullName.optional(),
        phone: phone.optional(),
        subscriptionPlan: subscriptionPlan.optional()
    }),
    query: z.unknown(),
    params: z.object({
        id: uuid("member")
    })
});

export const changeSubscriptionSchema = z.object({
    body: z.object({
        subscriptionPlan
    }),
    query: z.unknown(),
    params: z.object({
        id: uuid("member")
    })
});

export const workoutHistoryQuerySchema = z.object({
    body: z.unknown(),
    query: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(20),
        workoutType: z.enum(["strength", "cardio", "flexibility", "hiit", "crossfit", "yoga", "other"]).optional()
    }),
    params: z.unknown()
});
