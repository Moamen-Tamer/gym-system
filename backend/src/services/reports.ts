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
        values: allDays.map(day => dayCounts[day] ?? 0)
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

    const qrCode = await QRCode.toDataURL(qrData, {
        width: 360,
        margin: 1,
        color: {
            dark: "#e5e7eb",
            light: "#00000000"
        }
    });

    return qrCode;
};

export const getPrintableReportHtml = async (memberId: string): Promise<string> => {
    const report = await getMemberReport(memberId);
    const qrCode = await getReportQrCode(memberId);

    const formatDuration = (totalSeconds: number): string => {
        const safeSeconds = Number.isFinite(totalSeconds) ? totalSeconds : 0;
        const h = Math.floor(safeSeconds / 3600);
        const m = Math.floor((safeSeconds % 3600) / 60);
        const s = safeSeconds % 60;
        const sFormatted = s.toFixed(2);

        if (h > 0) return `${h}h ${m}m ${sFormatted}s`;
        if (m > 0) return `${m}m ${sFormatted}s`;

        return `${sFormatted}s`;
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

    const initials = report.member.full_name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]!.toUpperCase())
        .join("");

    const workoutRows = report.workouts
        .map((w, i) => `
            <tr style="animation-delay:${Math.min(i, 20) * 18}ms">
                <td>${formatDate(w.startTimestamp)}</td>
                <td>${w.endTimestamp ? formatDate(w.endTimestamp) : "—"}</td>
                <td class="mono">${w.duration != null ? formatDuration(w.duration) : "—"}</td>
                <td><span class="type-pill">${w.workoutType}</span></td>
                <td class="mono">${w.calories != null ? `${w.calories.toLocaleString()} kcal` : "—"}</td>
                <td class="feedback-cell">${w.feedback ?? "—"}</td>
            </tr>`)
        .join("");

    const dayIcons: Record<string, string> = {
        sunday: "S", monday: "M", tuesday: "T", wednesday: "W",
        thursday: "T", friday: "F", saturday: "S"
    };

    const byDayBars = report.stats.chart.byDay.labels
        .map((label, i) => {
            const val = report.stats.chart.byDay.values[i] ?? 0;
            const maxVal = Math.max(...report.stats.chart.byDay.values, 1);
            const pct = Math.max(val > 0 ? 6 : 0, Math.round((val / maxVal) * 100));
            const isPeak = label === report.stats.mostActiveDay && val > 0;
 
            return `
            <div class="bar-row">
                <span class="bar-label">${label.slice(0, 3)}</span>
                <div class="bar-track">
                    <div class="bar-fill ${isPeak ? "bar-fill--peak" : "bar-fill--day"}" style="width:${pct}%"></div>
                </div>
                <span class="bar-value">${val}</span>
            </div>`;
        })
        .join("");

    const byTypeBars = report.stats.chart.byType.labels
        .map((label, i) => {
            const val = report.stats.chart.byType.values[i] ?? 0;
            const maxVal = Math.max(...report.stats.chart.byType.values, 1);
            const pct = Math.max(val > 0 ? 6 : 0, Math.round((val / maxVal) * 100));
 
            return `
            <div class="bar-row">
                <span class="bar-label bar-label--wide">${label}</span>
                <div class="bar-track">
                    <div class="bar-fill bar-fill--type" style="width:${pct}%"></div>
                </div>
                <span class="bar-value">${val}</span>
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
                :root {
                    --bg: #0b0d12;
                    --bg-elevated: #12151c;
                    --bg-card: #151922;
                    --border: #232833;
                    --border-soft: #1b1f28;
                    --text: #e8eaf0;
                    --text-dim: #9096a5;
                    --text-faint: #5b6172;
                    --accent: #7c8cff;
                    --accent-soft: #7c8cff26;
                    --accent-2: #35d0ba;
                    --accent-2-soft: #35d0ba22;
                    --warn: #f0b429;
                }
 
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                    color-adjust: exact;
                }
 
                html {
                    background: var(--bg);
                }
 
                body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    background: var(--bg);
                    color: var(--text);
                    padding: 48px;
                    max-width: 960px;
                    margin: 0 auto;
                    line-height: 1.5;
                }
 
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(6px); }
                    to { opacity: 1; transform: translateY(0); }
                }
 
                .print-hint {
                    display: none;
                }
 
                @media print {
                    html, body { background: var(--bg) !important; }
                    body { padding: 20px; }
                    .no-print { display: none !important; }
                    .page-break { page-break-before: always; }
                    tr { animation: none !important; }
 
                    .print-hint {
                        display: block;
                        position: fixed;
                        bottom: 8px;
                        left: 0;
                        right: 0;
                        text-align: center;
                        font-size: 9px;
                        color: var(--text-faint);
                    }
                }
 
                .header {
                    display: grid;
                    grid-template-columns: 1fr auto;
                    gap: 28px;
                    align-items: stretch;
                    margin-bottom: 28px;
                    padding-bottom: 28px;
                    border-bottom: 1px solid var(--border);
                }
 
                .header-top {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 20px;
                }
 
                .brand-mark {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: var(--accent);
                    box-shadow: 0 0 12px 2px var(--accent-soft);
                }
 
                .brand-label {
                    font-size: 11px;
                    letter-spacing: 2px;
                    text-transform: uppercase;
                    color: var(--text-faint);
                    font-weight: 600;
                }
 
                .member-block {
                    display: flex;
                    align-items: center;
                    gap: 18px;
                    margin-bottom: 20px;
                }
 
                .avatar {
                    width: 56px;
                    height: 56px;
                    border-radius: 16px;
                    background: linear-gradient(135deg, var(--accent), #4b5bd6);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 20px;
                    font-weight: 700;
                    color: #fff;
                    flex-shrink: 0;
                    box-shadow: 0 8px 24px -8px var(--accent-soft);
                }
 
                .member-block h1 {
                    font-size: 22px;
                    font-weight: 700;
                    letter-spacing: -0.01em;
                }
 
                .member-block .email {
                    font-size: 13px;
                    color: var(--text-dim);
                    margin-top: 2px;
                }
 
                .plan-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    margin-top: 8px;
                    padding: 4px 10px;
                    border-radius: 999px;
                    background: var(--accent-soft);
                    color: var(--accent);
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: capitalize;
                    letter-spacing: 0.3px;
                }
 
                .plan-pill::before {
                    content: "";
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: var(--accent);
                }
 
                .member-info {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 16px 24px;
                    font-size: 13px;
                }
 
                .member-info dt {
                    color: var(--text-faint);
                    font-size: 10px;
                    text-transform: uppercase;
                    letter-spacing: 0.6px;
                    margin-bottom: 3px;
                }
 
                .member-info dd {
                    font-weight: 500;
                    color: var(--text);
                    text-transform: capitalize;
                }
 
                .qr-card {
                    background: var(--bg-elevated);
                    border: 1px solid var(--border);
                    border-radius: 16px;
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    width: 176px;
                }
 
                .qr-card img {
                    width: 140px;
                    height: 140px;
                    border-radius: 8px;
                }
 
                .qr-card .qr-caption {
                    font-size: 10px;
                    color: var(--text-faint);
                    text-align: center;
                    letter-spacing: 0.3px;
                }
 
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 14px;
                    margin-bottom: 28px;
                }
 
                .stat-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 14px;
                    padding: 20px;
                    position: relative;
                    overflow: hidden;
                }
 
                .stat-card::after {
                    content: "";
                    position: absolute;
                    top: -30px;
                    right: -30px;
                    width: 90px;
                    height: 90px;
                    border-radius: 50%;
                    background: var(--accent-soft);
                    filter: blur(4px);
                }
 
                .stat-card .value {
                    font-size: 26px;
                    font-weight: 700;
                    color: var(--text);
                    letter-spacing: -0.02em;
                    position: relative;
                }
 
                .stat-card .label {
                    font-size: 11px;
                    color: var(--text-faint);
                    margin-top: 6px;
                    text-transform: uppercase;
                    letter-spacing: 0.6px;
                    position: relative;
                }
 
                .section { margin-bottom: 28px; }
 
                .section-head {
                    display: flex;
                    align-items: baseline;
                    justify-content: space-between;
                    margin-bottom: 14px;
                }
 
                .section h2 {
                    font-size: 14px;
                    font-weight: 600;
                    color: var(--text);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
 
                .section h2::before {
                    content: "";
                    width: 3px;
                    height: 14px;
                    border-radius: 2px;
                    background: var(--accent);
                    display: inline-block;
                }
 
                .section-sub {
                    font-size: 11px;
                    color: var(--text-faint);
                }
 
                .chart-container {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
 
                .chart-box {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 14px;
                    padding: 18px;
                }
 
                .chart-box h3 {
                    font-size: 11px;
                    color: var(--text-faint);
                    margin-bottom: 14px;
                    text-transform: uppercase;
                    letter-spacing: 0.6px;
                    font-weight: 600;
                }
 
                .bar-row {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 9px;
                }
 
                .bar-row:last-child { margin-bottom: 0; }
 
                .bar-label {
                    width: 34px;
                    font-size: 11px;
                    color: var(--text-dim);
                    text-transform: capitalize;
                    flex-shrink: 0;
                }
 
                .bar-label--wide {
                    width: 84px;
                }
 
                .bar-track {
                    flex: 1;
                    background: var(--border-soft);
                    border-radius: 5px;
                    height: 14px;
                    overflow: hidden;
                }
 
                .bar-fill {
                    height: 100%;
                    border-radius: 5px;
                }
 
                .bar-fill--day { background: linear-gradient(90deg, #4b5bd6, var(--accent)); }
                .bar-fill--peak { background: linear-gradient(90deg, var(--accent-2), #52e6d2); }
                .bar-fill--type { background: linear-gradient(90deg, #1f9ee0, #3fc4f0); }
 
                .bar-value {
                    width: 24px;
                    font-size: 11px;
                    color: var(--text-dim);
                    text-align: right;
                    flex-shrink: 0;
                    font-variant-numeric: tabular-nums;
                }
 
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12.5px;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 14px;
                    overflow: hidden;
                }
 
                thead { background: var(--bg-elevated); }
 
                th {
                    text-align: left;
                    padding: 11px 14px;
                    font-weight: 600;
                    color: var(--text-faint);
                    font-size: 10.5px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    border-bottom: 1px solid var(--border);
                }
 
                td {
                    padding: 11px 14px;
                    border-bottom: 1px solid var(--border-soft);
                    color: var(--text);
                }
 
                tr:last-child td { border-bottom: none; }
 
                tbody tr {
                    animation: fadeUp 0.35s ease backwards;
                }
 
                tbody tr:hover td { background: var(--bg-elevated); }
 
                .mono {
                    font-variant-numeric: tabular-nums;
                    color: var(--text-dim);
                }
 
                .type-pill {
                    display: inline-block;
                    padding: 3px 9px;
                    border-radius: 999px;
                    background: var(--accent-2-soft);
                    color: var(--accent-2);
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: capitalize;
                }
 
                .feedback-cell {
                    color: var(--text-dim);
                    max-width: 220px;
                }
 
                .empty-row td {
                    text-align: center;
                    color: var(--text-faint);
                    padding: 32px;
                }
 
                .footer {
                    margin-top: 32px;
                    padding-top: 16px;
                    border-top: 1px solid var(--border);
                    display: flex;
                    justify-content: space-between;
                    font-size: 10.5px;
                    color: var(--text-faint);
                    letter-spacing: 0.3px;
                }
 
                .print-btn {
                    position: fixed;
                    top: 24px;
                    right: 24px;
                    background: var(--accent);
                    color: #0b0d12;
                    border: none;
                    padding: 10px 18px;
                    border-radius: 10px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 600;
                    box-shadow: 0 8px 24px -8px var(--accent-soft);
                }
 
                .print-btn:hover { filter: brightness(1.08); }
 
                @media (max-width: 640px) {
                    .header { grid-template-columns: 1fr; }
                    .qr-card { width: 100%; flex-direction: row; }
                    .stats-grid { grid-template-columns: 1fr; }
                    .chart-container { grid-template-columns: 1fr; }
                    .member-info { grid-template-columns: 1fr 1fr; }
                }
            </style>
        </head>
        <body>
            <button class="print-btn no-print" onclick="window.print()" title="If the print preview looks light, enable &quot;Background graphics&quot; in the print dialog's more settings.">Print Report</button>
 
            <div class="header">
                <div>
                    <div class="header-top">
                        <span class="brand-mark"></span>
                        <span class="brand-label">Gym Member Report</span>
                    </div>
 
                    <div class="member-block">
                        <div class="avatar">${initials || "?"}</div>
                        <div>
                            <h1>${report.member.full_name}</h1>
                            <div class="email">${report.member.email}</div>
                            <div class="plan-pill">${report.member.subscription_plan} · ${report.member.subscription_status}</div>
                        </div>
                    </div>
 
                    <dl class="member-info">
                        <div><dt>Phone</dt><dd>${report.member.phone ?? "N/A"}</dd></div>
                        <div><dt>Member Since</dt><dd>${new Date(report.member.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</dd></div>
                        <div><dt>Workout Days</dt><dd>${report.member.allowed_workout_days.join(", ")}</dd></div>
                    </dl>
                </div>
 
                <div class="qr-card">
                    <img src="${qrCode}" alt="QR Code" width="140" height="140" />
                    <span class="qr-caption">Scan for<br/>report summary</span>
                </div>
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
                <div class="section-head">
                    <h2>Activity Charts</h2>
                    <span class="section-sub">Most active: <strong style="color:var(--text-dim);text-transform:capitalize">${report.stats.mostActiveDay}</strong></span>
                </div>
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
                <div class="section-head">
                    <h2>Workout History</h2>
                    <span class="section-sub">${report.workouts.length} record${report.workouts.length === 1 ? "" : "s"}</span>
                </div>
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
                        ${workoutRows || '<tr class="empty-row"><td colspan="6">No workouts recorded yet.</td></tr>'}
                    </tbody>
                </table>
            </div>
 
            <div class="footer">
                <span>Generated ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
                <span>Member ID · ${report.member.id ?? memberId}</span>
            </div>
        </body>
        </html>`;
};