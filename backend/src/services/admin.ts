import { HttpError } from "../errors/HttpError.js";
import { env } from "../config/env.js";
import jwt from "jsonwebtoken";
import { countMembers, countActiveSubscriptions } from "../repositories/members.js";
import { countAllWorkouts, sumAllCalories, averageAllDuration, getMostPopularWorkoutType, fetchWorkoutHistory } from "../repositories/workouts.js";
import { fetchMemberById } from "../repositories/members.js";
import type { GymStatistics } from "../types/blueprints.js";
import { redis } from "../connections/redis.js";
import { makeGymStatsKey } from "../utils/redis.js";
import { cacheGymStats } from "../repositories/cache.js";

export const adminLogin = async (email: string, password: string): Promise<{ token: string }> => {
    if (email !== env.adminEmail || password !== env.adminPassword) throw new HttpError(401, "Invalid admin credentials.");

    const token = jwt.sign(
        { role: "admin", email: env.adminEmail },
        env.adminEmail + env.adminPassword,
        { expiresIn: "24h" }
    );

    return { token };
};

export const getMemberWorkoutHistory = async (memberId: string, page: number, limit: number) => {
    const member = await fetchMemberById(memberId);

    if (!member) throw new HttpError(404, "Member not found.");

    const { workouts, total } = await fetchWorkoutHistory(memberId, page, limit);

    return { member, workouts, total, page, limit };
};

export const getGymStatistics = async (): Promise<GymStatistics> => {
    try {
        const cached = await redis.get(makeGymStatsKey()).catch(() => null);

        if (cached) {
            const parsed = JSON.parse(cached);

            if (parsed.totalMembers > 0) return parsed;
        }
    } catch { }

    const [totalMembers, activeSubscriptions, totalWorkouts, totalCalories, averageDuration, mostPopularWorkoutType] = await Promise.all([
        countMembers(),
        countActiveSubscriptions(),
        countAllWorkouts(),
        sumAllCalories(),
        averageAllDuration(),
        getMostPopularWorkoutType()
    ]);

    const stats: GymStatistics = {
        totalMembers,
        activeSubscriptions,
        totalWorkouts,
        totalCalories,
        averageDuration,
        mostPopularWorkoutType
    };

    if (totalMembers > 0) await cacheGymStats(stats).catch(() => {});

    return stats;
};
