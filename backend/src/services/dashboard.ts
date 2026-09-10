import {
    countMemberWorkouts, sumMemberCalories, averageMemberDuration, getWorkoutsByDay, getWorkoutsByType,
    countAllWorkouts, sumAllCalories, averageAllDuration, getAllWorkoutsByDay, getAllWorkoutsByType
} from "../repositories/workouts.js";
import type { DashboardStats, ChartData } from "../types/blueprints.js";
import { cacheDashboard } from "../repositories/cache.js";
import { makeDashboardKey } from "../utils/redis.js";
import { redis } from "../connections/redis.js";

const buildChartData = (
    dayCounts: Record<string, number>,
    typeCounts: Record<string, number>
): { byDay: ChartData; byType: ChartData } => {
    const orderedDays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

    const byDay: ChartData = {
        labels: orderedDays,
        values: orderedDays.map((day: string) => dayCounts[day] ?? 0)
    };

    const byType: ChartData = {
        labels: Object.keys(typeCounts),
        values: Object.values(typeCounts)
    };

    return { byDay, byType };
};

export const getDashboard = async (memberId: string): Promise<DashboardStats> => {
    try {
        const cached = await redis.get(makeDashboardKey(memberId)).catch(() => null);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.totalWorkouts > 0) return parsed;
        }
    } catch { }

    let [totalWorkouts, totalCalories, averageDuration, dayCounts, typeCounts] = await Promise.all([
        countMemberWorkouts(memberId),
        sumMemberCalories(memberId),
        averageMemberDuration(memberId),
        getWorkoutsByDay(memberId),
        getWorkoutsByType(memberId)
    ]);

    if (totalWorkouts === 0) {
        [totalWorkouts, totalCalories, averageDuration, dayCounts, typeCounts] = await Promise.all([
            countAllWorkouts(),
            sumAllCalories(),
            averageAllDuration(),
            getAllWorkoutsByDay(),
            getAllWorkoutsByType()
        ]);
    }

    const allDays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

    let mostActiveDay = "none";
    let leastActiveDay = "none";
    let maxCount = -1;
    let minCount = Infinity;

    for (const day of allDays) {
        const count = dayCounts[day] ?? 0;

        if (count > maxCount) {
            maxCount = count;
            mostActiveDay = day;
        }

        if (count < minCount && count > 0) {
            minCount = count;
            leastActiveDay = day;
        }
    }

    if (maxCount <= 0) mostActiveDay = "none";
    if (minCount === Infinity) leastActiveDay = "none";

    const chart = buildChartData(dayCounts, typeCounts);

    const stats: DashboardStats = {
        totalWorkouts,
        totalCalories,
        averageDuration,
        mostActiveDay,
        leastActiveDay,
        chart
    };

    if (totalWorkouts > 0) {
        try {
            await cacheDashboard(memberId, stats).catch(() => {});
        } catch { }
    }

    return stats;
};
