import mongoose from "mongoose";
import Workout from "../models/workout.model.js";
import { HttpError } from "../errors/HttpError.js";

const isMongoReady = (): boolean => mongoose.connection.readyState === 1;

export const createWorkout = async (
    memberId: string,
    workoutType: string
) => {
    if (!isMongoReady()) throw new HttpError(503, "Database service unavailable");

    const workout = new Workout({
        memberId,
        startTimestamp: new Date(),
        workoutType
    });

    await workout.save();

    return workout;
};

export const stopWorkout = async (
    workoutId: string,
    memberId: string,
    calories?: number
) => {
    if (!isMongoReady()) throw new HttpError(503, "Database service unavailable");

    const workout = await Workout.findOne({ 
        _id: workoutId, 
        memberId
    });

    if (!workout) throw new HttpError(404, "workout not found");

    if (workout.endTimestamp) {
        return workout;
    }

    const endTimestamp = new Date();
    const durationMs = endTimestamp.getTime() - workout.startTimestamp.getTime();
    const durationSec = Math.round(durationMs / 1000);

    workout.endTimestamp = endTimestamp;
    workout.duration = durationSec;
    workout.calories = calories ?? workout.calories ?? null;

    await workout.save();

    return workout;
};

export const addFeedback = async (
    workoutId: string,
    memberId: string,
    feedback: string
) => {
    if (!isMongoReady()) throw new HttpError(503, "Database service unavailable");

    const workout = await Workout.findOne({ 
        _id: workoutId, 
        memberId 
    });

    if (!workout) throw new HttpError(404, "workout not found");

    workout.feedback = feedback;

    await workout.save();

    return workout;
};

export const fetchWorkoutHistory = async (
    memberId: string,
    page: number,
    limit: number,
    workoutType?: string
) => {
    if (!isMongoReady()) return { workouts: [], total: 0 };

    try {
        const filter: Record<string, unknown> = { memberId };

        if (workoutType) filter.workoutType = workoutType;

        const total = await Workout.countDocuments(filter);

        const workouts = await Workout
            .find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        return { workouts, total };
    } catch {
        return { workouts: [], total: 0 };
    }
};

export const countMemberWorkouts = async (
    memberId: string
): Promise<number> => {
    if (!isMongoReady()) return 0;
    try {
        return await Workout.countDocuments({ memberId });
    } catch {
        return 0;
    }
};

export const sumMemberCalories = async (
    memberId: string
): Promise<number> => {
    if (!isMongoReady()) return 0;
    try {
        const result = await Workout.aggregate([
            { $match: { memberId, calories: { $ne: null } } },
            { $group: { _id: null, total: { $sum: "$calories" } } }
        ]);

        return result[0]?.total ?? 0;
    } catch {
        return 0;
    }
};

export const averageMemberDuration = async (
    memberId: string
): Promise<number> => {
    if (!isMongoReady()) return 0;
    try {
        const result = await Workout.aggregate([
            { $match: { memberId, duration: { $ne: null } } },
            { $group: { _id: null, avg: { $avg: "$duration" } } }
        ]);

        return result[0]?.avg ?? 0;
    } catch {
        return 0;
    }
};

export const getActiveWorkout = async (
    memberId: string
) => {
    if (!isMongoReady()) return null;
    try {
        return await Workout.findOne({ memberId, endTimestamp: null }).lean();
    } catch {
        return null;
    }
};

export const getWorkoutsByDay = async (
    memberId: string
): Promise<Record<string, number>> => {
    if (!isMongoReady()) return {};
    try {
        const result = await Workout.aggregate([
            { $match: { memberId } },
            {
                $group: {
                    _id: { $dayOfWeek: "$startTimestamp" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const dayMap: Record<number, string> = {
            1: "sunday", 2: "monday", 3: "tuesday", 4: "wednesday",
            5: "thursday", 6: "friday", 7: "saturday"
        };

        const dayCounts: Record<string, number> = {};

        for (const dayResult of result) {
            const dayName = dayMap[dayResult._id] ?? "unknown";
            dayCounts[dayName] = dayResult.count;
        }

        return dayCounts;
    } catch {
        return {};
    }
};

export const countAllWorkouts = async (): Promise<number> => {
    if (!isMongoReady()) return 0;
    try {
        return await Workout.countDocuments();
    } catch {
        return 0;
    }
};

export const sumAllCalories = async (): Promise<number> => {
    if (!isMongoReady()) return 0;
    try {
        const result = await Workout.aggregate([
            { $match: { calories: { $ne: null } } },
            { $group: { _id: null, total: { $sum: "$calories" } } }
        ]);

        return result[0]?.total ?? 0;
    } catch {
        return 0;
    }
};

export const averageAllDuration = async (): Promise<number> => {
    if (!isMongoReady()) return 0;
    try {
        const result = await Workout.aggregate([
            { $match: { duration: { $ne: null } } },
            { $group: { _id: null, avg: { $avg: "$duration" } } }
        ]);

        return result[0]?.avg ?? 0;
    } catch {
        return 0;
    }
};

export const getMostPopularWorkoutType = async (): Promise<string> => {
    if (!isMongoReady()) return "none";
    try {
        const result = await Workout.aggregate([
            { $group: { _id: "$workoutType", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 }
        ]);

        return result[0]?._id ?? "none";
    } catch {
        return "none";
    }
};

export const getWorkoutsByType = async (
    memberId: string
): Promise<Record<string, number>> => {
    if (!isMongoReady()) return {};
    try {
        const result = await Workout.aggregate([
            { $match: { memberId } },
            { $group: { _id: "$workoutType", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        const typeCounts: Record<string, number> = {};

        for (const typeResult of result) {
            typeCounts[typeResult._id] = typeResult.count;
        }

        return typeCounts;
    } catch {
        return {};
    }
};

export const getAllWorkoutsByDay = async (): Promise<Record<string, number>> => {
    if (!isMongoReady()) return {};
    try {
        const result = await Workout.aggregate([
            {
                $group: {
                    _id: { $dayOfWeek: "$startTimestamp" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const dayMap: Record<number, string> = {
            1: "sunday", 2: "monday", 3: "tuesday", 4: "wednesday",
            5: "thursday", 6: "friday", 7: "saturday"
        };

        const dayCounts: Record<string, number> = {};

        for (const dayResult of result) {
            const dayName = dayMap[dayResult._id] ?? "unknown";
            dayCounts[dayName] = dayResult.count;
        }

        return dayCounts;
    } catch {
        return {};
    }
};

export const getAllWorkoutsByType = async (): Promise<Record<string, number>> => {
    if (!isMongoReady()) return {};
    try {
        const result = await Workout.aggregate([
            { $group: { _id: "$workoutType", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        const typeCounts: Record<string, number> = {};

        for (const typeResult of result) {
            typeCounts[typeResult._id] = typeResult.count;
        }

        return typeCounts;
    } catch {
        return {};
    }
};