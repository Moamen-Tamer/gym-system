import { HttpError } from "../errors/HttpError.js";
import { fetchMemberById } from "../repositories/members.js";
import { fetchWorkoutHistory, countMemberWorkouts, sumMemberCalories, averageMemberDuration, getWorkoutsByDay, getWorkoutsByType } from "../repositories/workouts.js";
import type { MemberReport, DashboardStats, Workout, ChartData } from "../types/blueprints.js";
import { cacheReport } from "../repositories/cache.js";
import { makeReportKey } from "../utils/redis.js";
import { redis } from "../connections/redis.js";
import QRCode from "qrcode";

const buildStats = async (memberId: string): Promise<DashboardStats> => {
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

    const byDay: ChartData = {
        labels: allDays,
        values: allDays.map(d => dayCounts[d] ?? 0)
    };

    const byType: ChartData = {
        labels: Object.keys(typeCounts),
        values: Object.values(typeCounts)
    };

    return {
        totalWorkouts,
        totalCalories,
        averageDuration,
        mostActiveDay,
        leastActiveDay,
        chart: { byDay, byType }
    };
};

export const getMemberReport = async (memberId: string): Promise<MemberReport> => {
    const cached = await redis.get(makeReportKey(memberId));

    if (cached) return JSON.parse(cached);

    const member = await fetchMemberById(memberId);

    if (!member) throw new HttpError(404, "Member not found.");

    const { workouts } = await fetchWorkoutHistory(memberId, 1, 100);

    const stats = await buildStats(memberId);

    const report: MemberReport = { member, workouts: workouts as unknown as Workout[], stats };

    await cacheReport(memberId, report);

    return report;
};

export const getReportQrCode = async (memberId: string): Promise<string> => {
    const report = await getMemberReport(memberId);

    const summary = {
        member: report.member.full_name,
        email: report.member.email,
        plan: report.member.subscription_plan,
        totalWorkouts: report.stats.totalWorkouts,
        totalCalories: report.stats.totalCalories,
        averageDuration: `${report.stats.averageDuration}s`,
        mostActiveDay: report.stats.mostActiveDay
    };

    const qrData = JSON.stringify(summary);

    const qrCode = await QRCode.toDataURL(qrData, { width: 300, margin: 2 });

    return qrCode;
};

export const getPrintableReportHtml = async (memberId: string): Promise<string> => {
    const report = await getMemberReport(memberId);
    const qrCode = await getReportQrCode(memberId);

    const formatDuration = (seconds: number): string => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;

        if (h > 0) return `${h}h ${m}m ${s}s`;
        if (m > 0) return `${m}m ${s}s`;

        return `${s}s`;
    };

    const formatDate = (date: Date | string): string => {
        const d = new Date(date);

        return d.toLocaleDateString("en-EG", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    const workoutRows = report.workouts
        .map(w => `
            <tr>
                <td>${formatDate(w.startTimestamp)}</td>
                <td>${w.endTimestamp ? formatDate(w.endTimestamp) : "—"}</td>
                <td>${w.duration ? formatDuration(w.duration) : "—"}</td>
                <td style="text-transform: capitalize">${w.workoutType}</td>
                <td>${w.calories ?? "—"}</td>
                <td>${w.feedback ?? "—"}</td>
            </tr>`)
        .join("");

    const byDayBars = report.stats.chart.byDay.labels
        .map((label, i) => {
            const val = report.stats.chart.byDay.values[i] ?? 0;
            const maxVal = Math.max(...report.stats.chart.byDay.values, 1);
            const pct = Math.round((val / maxVal) * 100);

            return `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span style="width:70px;font-size:12px;text-transform:capitalize">${label}</span>
                <div style="flex:1;background:#f0f0f0;border-radius:4px;height:18px;position:relative">
                    <div style="width:${pct}%;background:#4f46e5;height:100%;border-radius:4px"></div>
                </div>
                <span style="width:30px;font-size:12px;text-align:right">${val}</span>
            </div>`;
        })
        .join("");

    const byTypeBars = report.stats.chart.byType.labels
        .map((label, i) => {
            const val = report.stats.chart.byType.values[i] ?? 0;
            const maxVal = Math.max(...report.stats.chart.byType.values, 1);
            const pct = Math.round((val / maxVal) * 100);

            return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span style="width:90px;font-size:12px;text-transform:capitalize">${label}</span>
                <div style="flex:1;background:#f0f0f0;border-radius:4px;height:18px;position:relative">
                    <div style="width:${pct}%;background:#0ea5e9;height:100%;border-radius:4px"></div>
                </div>
                <span style="width:30px;font-size:12px;text-align:right">${val}</span>
            </div>`;
        })
        .join("");

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Member Report — ${report.member.full_name}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1f2937; padding: 40px; max-width: 900px; margin: 0 auto; }
                @media print {
                    body { padding: 20px; }
                    .no-print { display: none; }
                    .page-break { page-break-before: always; }
                }
                .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 2px solid #4f46e5; padding-bottom: 16px; }
                .header h1 { font-size: 24px; color: #4f46e5; }
                .header p { font-size: 13px; color: #6b7280; margin-top: 4px; }
                .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }
                .stat-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center; }
                .stat-card .value { font-size: 28px; font-weight: 700; color: #4f46e5; }
                .stat-card .label { font-size: 12px; color: #6b7280; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
                .section { margin-bottom: 32px; }
                .section h2 { font-size: 16px; margin-bottom: 12px; color: #374151; border-left: 3px solid #4f46e5; padding-left: 8px; }
                .chart-container { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
                .chart-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
                .chart-box h3 { font-size: 13px; color: #6b7280; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
                table { width: 100%; border-collapse: collapse; font-size: 13px; }
                thead { background: #f3f4f6; }
                th { text-align: left; padding: 8px 12px; font-weight: 600; color: #374151; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; }
                td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
                tr:hover td { background: #f9fafb; }
                .qr-section { text-align: center; margin-top: 32px; }
                .qr-section img { border: 1px solid #e5e7eb; border-radius: 8px; }
                .member-info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 14px; margin-bottom: 24px; }
                .member-info dt { color: #6b7280; font-size: 12px; text-transform: uppercase; }
                .member-info dd { font-weight: 500; }
                .print-btn { position: fixed; top: 20px; right: 20px; background: #4f46e5; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; }
                .print-btn:hover { background: #4338ca; }
            </style>
        </head>
        <body>
            <button class="print-btn no-print" onclick="window.print()">Print Report</button>
        
            <div class="header">
                <div>
                    <h1>Gym Member Report</h1>
                    <p>Generated on ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
                </div>
                <div style="text-align:right">
                    <div style="font-size:13px;color:#6b7280">Subscription</div>
                    <div style="font-size:18px;font-weight:700;text-transform:capitalize;color:#4f46e5">${report.member.subscription_plan}</div>
                </div>
            </div>
        
            <div class="section">
                <h2>Member Information</h2>
                <dl class="member-info">
                    <div><dt>Name</dt><dd>${report.member.full_name}</dd></div>
                    <div><dt>Email</dt><dd>${report.member.email}</dd></div>
                    <div><dt>Phone</dt><dd>${report.member.phone ?? "N/A"}</dd></div>
                    <div><dt>Status</dt><dd style="text-transform:capitalize">${report.member.subscription_status}</dd></div>
                    <div><dt>Member Since</dt><dd>${new Date(report.member.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</dd></div>
                    <div><dt>Workout Days</dt><dd style="text-transform:capitalize">${report.member.allowed_workout_days.join(", ")}</dd></div>
                </dl>
            </div>
        
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="value">${report.stats.totalWorkouts}</div>
                    <div class="label">Total Workouts</div>
                </div>
                <div class="stat-card">
                    <div class="value">${report.stats.totalCalories.toLocaleString()}</div>
                    <div class="label">Total Calories</div>
                </div>
                <div class="stat-card">
                    <div class="value">${formatDuration(report.stats.averageDuration)}</div>
                    <div class="label">Avg Duration</div>
                </div>
            </div>
        
            <div class="section">
                <h2>Activity Charts</h2>
                <div class="chart-container">
                    <div class="chart-box">
                        <h3>Workouts by Day</h3>
                        ${byDayBars}
                    </div>
                    <div class="chart-box">
                        <h3>Workouts by Type</h3>
                        ${byTypeBars}
                    </div>
                </div>
            </div>
        
            <div class="section page-break">
                <h2>Workout History</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Start</th>
                            <th>End</th>
                            <th>Duration</th>
                            <th>Type</th>
                            <th>Calories</th>
                            <th>Feedback</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${workoutRows || '<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:24px">No workouts recorded yet.</td></tr>'}
                    </tbody>
                </table>
            </div>
        
            <div class="qr-section">
                <p style="font-size:12px;color:#6b7280;margin-bottom:8px">Scan QR code for report summary</p>
                <img src="${qrCode}" alt="QR Code" width="200" height="200" />
            </div>
        </body>
        </html>`;
};  
    