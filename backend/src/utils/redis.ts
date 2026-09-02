export const makeMemberKey = (memberId: string): string => {
    return `member:${memberId}`;
};

export const makeDashboardKey = (memberId: string): string => {
    return `dashboard:${memberId}`;
};

export const makeGymStatsKey = (): string => {
    return `gym:stats`;
};

export const makeReportKey = (memberId: string): string => {
    return `report:${memberId}`;
};
