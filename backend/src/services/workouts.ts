import { HttpError } from "../errors/HttpError.js";
import { createWorkout, stopWorkout, addFeedback, fetchWorkoutHistory, getActiveWorkout } from "../repositories/workouts.js";
import { getWorkoutDays } from "./members.js";
import { invalidateDashboardCache, invalidateReportCache } from "../repositories/cache.js";

export const startWorkout = async (memberId: string, workoutType: string) => {
    const activeWorkout = await getActiveWorkout(memberId);

    if (activeWorkout) throw new HttpError(409, "You already have an active workout. Stop it first.");

    const allowedDays = await getWorkoutDays(memberId);
    const today = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();

    if (!allowedDays.includes(today)) throw new HttpError(403, `Today is ${today}. Your plan does not allow workouts on this day.`);

    const workout = await createWorkout(memberId, workoutType);

    return workout;
};

export const stopWorkoutSession = async (workoutId: string, memberId: string, calories?: number) => {
    const workout = await stopWorkout(workoutId, memberId, calories);

    await invalidateDashboardCache(memberId);
    await invalidateReportCache(memberId);

    return workout;
};

export const submitFeedback = async (workoutId: string, memberId: string, feedback: string) => {
    const workout = await addFeedback(workoutId, memberId, feedback);

    return workout;
};

export const getWorkoutHistory = async (memberId: string, page: number, limit: number, workoutType?: string) => {
    const { workouts, total } = await fetchWorkoutHistory(memberId, page, limit, workoutType);

    return { workouts, total, page, limit };
};
