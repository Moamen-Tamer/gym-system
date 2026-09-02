import { redis } from "../connections/redis.js";
import { makeDashboardKey, makeGymStatsKey, makeMemberKey, makeReportKey } from "../utils/redis.js";

export const cacheMember = async (memberId: string, data: object): Promise<void> => {
    await redis.set(makeMemberKey(memberId), JSON.stringify(data), "EX", 3600);
};

export const invalidateMemberCache = async (memberId: string): Promise<void> => {
    const key = makeMemberKey(memberId);

    await redis.del(key);
};

export const fetchCachedMember = async (memberId: string): Promise<object | null> => {
    const key = makeMemberKey(memberId);

    const data = await redis.get(key);

    if (!data) return null;

    return JSON.parse(data);
};

export const cacheDashboard = async (memberId: string, data: object): Promise<void> => {
    await redis.set(makeDashboardKey(memberId), JSON.stringify(data), "EX", 600);
};

export const invalidateDashboardCache = async (memberId: string): Promise<void> => {
    const key = makeDashboardKey(memberId);

    await redis.del(key);
};

export const cacheGymStats = async (data: object): Promise<void> => {
    await redis.set(makeGymStatsKey(), JSON.stringify(data), "EX", 300);
};

export const invalidateGymStatsCache = async (): Promise<void> => {
    const key = makeGymStatsKey();

    await redis.del(key);
};

export const cacheReport = async (memberId: string, data: object): Promise<void> => {
    await redis.set(makeReportKey(memberId), JSON.stringify(data), "EX", 1800);
};

export const invalidateReportCache = async (memberId: string): Promise<void> => {
    const key = makeReportKey(memberId);

    await redis.del(key);
};