import z from "zod";
import { uuid } from "./common.js";

const workoutType = z.enum(["strength", "cardio", "flexibility", "hiit", "crossfit", "yoga", "other"], {
    message: "workout type must be strength, cardio, flexibility, hiit, crossfit, yoga, or other"
});

export const startWorkoutSchema = z.object({
    body: z.object({
        workoutType
    }),
    query: z.unknown(),
    params: z.unknown()
});

export const stopWorkoutSchema = z.object({
    body: z.object({
        calories: z.number().int().min(0, "calories must be 0 or more").optional()
    }),
    query: z.unknown(),
    params: z.object({
        id: uuid("workout")
    })
});

export const feedbackSchema = z.object({
    body: z.object({
        feedback: z.string().trim().min(1, "feedback is required").max(1000, "feedback must be 1000 characters or less")
    }),
    query: z.unknown(),
    params: z.object({
        id: uuid("workout")
    })
});

export const memberWorkoutHistorySchema = z.object({
    body: z.unknown(),
    query: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(20),
        workoutType: workoutType.optional()
    }),
    params: z.unknown()
});

export const adminWorkoutHistorySchema = z.object({
    body: z.unknown(),
    query: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(20)
    }),
    params: z.object({
        memberId: uuid("member")
    })
});
