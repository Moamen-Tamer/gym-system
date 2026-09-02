import type { Request, Response, NextFunction } from "express";
import * as workoutService from "../services/workouts.js";
import { HttpError } from "../errors/HttpError.js";

export const startWorkout = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user) throw new HttpError(401, "authentication required");

        const workout = await workoutService.startWorkout(req.user.id, req.body.workoutType);

        res.status(201).json({
            message: "Workout started.",
            workout: {
                id: workout._id,
                memberId: workout.memberId,
                startTimestamp: workout.startTimestamp,
                workoutType: workout.workoutType
            }
        });
    } catch (error) {
        next(error);
    }
};

export const stopWorkout = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user) throw new HttpError(401, "authentication required");

        const workout = await workoutService.stopWorkoutSession(req.params.id, req.user.id, req.body.calories);

        res.status(200).json({
            message: "Workout stopped.",
            workout: {
                id: workout._id,
                memberId: workout.memberId,
                startTimestamp: workout.startTimestamp,
                endTimestamp: workout.endTimestamp,
                duration: workout.duration,
                workoutType: workout.workoutType,
                calories: workout.calories
            }
        });
    } catch (error) {
        next(error);
    }
};

export const submitFeedback = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user) throw new HttpError(401, "authentication required");

        const workout = await workoutService.submitFeedback(req.params.id, req.user.id, req.body.feedback);

        res.status(200).json({
            message: "Feedback submitted.",
            workout: {
                id: workout._id,
                feedback: workout.feedback
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getWorkoutHistory = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user) throw new HttpError(401, "authentication required");

        const query = req.validated?.query as { page?: number; limit?: number; workoutType?: string } | undefined;

        const { workouts, total, page, limit } = await workoutService.getWorkoutHistory(
            req.user.id,
            query?.page ?? 1,
            query?.limit ?? 20,
            query?.workoutType
        );

        res.status(200).json({
            workouts,
            total,
            page,
            limit
        });
    } catch (error) {
        next(error);
    }
};
