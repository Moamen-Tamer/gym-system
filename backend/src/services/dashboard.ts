import { HttpError } from "../errors/HttpError.js";
import { fetchMemberById } from "../repositories/members.js";
import { countMemberWorkouts, sumMemberCalories, averageMemberDuration, getWorkoutsByDay, getWorkoutsByType } from "../repositories/workouts.js";
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
    const cached = await redis.get(makeDashboardKey(memberId));

    if (cached) return JSON.parse(cached);

    const member = await fetchMemberById(memberId);

    if (!member) throw new HttpError(404, "Member not found.");

    const [totalWorkouts, totalCalories, averageDuration, dayCounts, typeCounts] = await Promise.all([
        countMemberWorkouts(memberId),
        sumMemberCalories(memberId),
        averageMemberDuration(memberId),
        getWorkoutsByDay(memberId),
        getWorkoutsByType(memberId)
    ]);

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

    await cacheDashboard(memberId, stats);

    return stats;
};
