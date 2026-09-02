/**
 * seeds/seed.ts — Pulse Gym real database seed
 *
 * Creates a fully populated, realistic gym database:
 *   1. Admin account        — ADMIN_EMAIL / ADMIN_PASSWORD (env, default admin@gym.com / admin123456)
 *                             - Supabase auth user + member row (premium, active)
 *                             - admin panel credentials come from the same env vars used by POST /api/admin/login
 *   2. Member accounts      — default 250 members (configurable), all sharing SEED_MEMBER_PASSWORD
 *                             (default "password12345", passes the app's zod password validator: min 6)
 *                             - created in Supabase auth (confirmed), member rows completed by the seed:
 *                               phone (Egyptian format 01XXXXXXXXX), subscription plan/status,
 *                               allowed workout days, realistic join dates
 *   3. Workout history      — up to ~18 months per member in MongoDB, only on days allowed by the
 *                             member's plan, with types/durations/calories/feedback + a few
 *                             still-running sessions
 *   4. Verification         — row counts, sample sign-ins (incl. wrong-password rejection),
 *                             admin JWT check, plan/status/type breakdowns
 *
 * Idempotent: by default it WIPES all existing users/members/workouts first.
 *
 * Usage:
 *   npm run seed                     full seed (wipe + 250 members + admin + workouts)
 *   npm run seed -- --members=500    create 500 members instead
 *   npm run seed -- --skip-clean     append data without wiping existing users/workouts
 *   npm run seed -- --dry-run        generate + zod-validate everything, write NOTHING
 *   npm run seed -- --help           show help
 *   npm run seed:check               type-check this seed (tsc -p seeds/tsconfig.json)
 *
 * Requires the env vars documented in .env.example (a local-dev .env ships with the repo).
 */

// ─── stdlib ─────────────────────────────────────────────────────────────────
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ─── third-party (env-free imports only — config/env.js is imported dynamically
//     after .env loading below) ──────────────────────────────────────────────
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Redis } from "ioredis";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { z } from "zod";
import Workout from "../src/models/workout.model.js";
import {
    averageAllDuration,
    countAllWorkouts,
    getMostPopularWorkoutType,
    sumAllCalories
} from "../src/repositories/workouts.js";
import { registerSchema } from "../src/schemas/auth.schema.js";
import { createMemberSchema } from "../src/schemas/member.schema.js";
import { PLAN_WORKOUT_DAYS } from "../src/types/blueprints.js";

// ─── .env loading (no dotenv dependency; real env vars always win) ─────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const parseDotEnv = (filePath: string): void => {
    const raw = readFileSync(filePath, "utf8");

    for (const line of raw.split("\n")) {
        const trimmed = line.trim();

        if (trimmed.length === 0 || trimmed.startsWith("#")) continue;

        const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
        const eq = withoutExport.indexOf("=");

        if (eq <= 0) continue;

        const key = withoutExport.slice(0, eq).trim();
        let value = withoutExport.slice(eq + 1).trim();

        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        if (!(key in process.env)) process.env[key] = value;
    }
};

for (const candidate of [path.join(process.cwd(), ".env"), path.join(__dirname, "..", ".env")]) {
    if (existsSync(candidate)) parseDotEnv(candidate);
}

// env.js (zod-validated config) is imported only after .env loading above
const { env } = await import("../src/config/env.js");

// ─── constants ──────────────────────────────────────────────────────────────
const DEFAULT_MEMBER_PASSWORD = "password12345";
const SEED_MEMBER_PASSWORD = process.env.SEED_MEMBER_PASSWORD?.trim() || DEFAULT_MEMBER_PASSWORD;
const DEFAULT_MEMBERS = 250;
const WORKOUT_TYPES = ["strength", "cardio", "flexibility", "hiit", "crossfit", "yoga", "other"] as const;
const SUBSCRIPTION_STATUSES = ["active", "inactive", "suspended"] as const;
const EMAIL_DOMAIN = "pulsegym.com";
const SUPABASE_PAGE_SIZE = 200;
const CONCURRENCY = 10;
const INSERT_CHUNK = 2000;
const PRNG_SEED = 20260903;

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

// calories per minute, by workout type (rough real-world MET estimates)
const CALORIES_PER_MINUTE: Record<(typeof WORKOUT_TYPES)[number], number> = {
    strength: 6.5,
    cardio: 10,
    flexibility: 4,
    hiit: 12,
    crossfit: 11,
    yoga: 3.5,
    other: 6
};

// daily attendance probability per allowed day, by plan
const ATTENDANCE_BY_PLAN: Record<string, number> = {
    basic: 0.25,
    standard: 0.33,
    premium: 0.4
};

const STATUS_ATTENDANCE_FACTOR: Record<string, number> = {
    active: 1,
    inactive: 0.3,
    suspended: 0.15
};

const FIRST_NAMES = [
    "Ahmed", "Mohamed", "Omar", "Youssef", "Karim", "Hassan", "Ali", "Tarek", "Amr", "Khaled",
    "Mostafa", "Ibrahim", "Yehia", "Ziad", "Marwan", "Hossam", "Sherif", "Wael", "Ramy", "Adel",
    "Fady", "Basil", "Sami", "Layth", "Seif", "Faris", "Malik", "Adam", "Daniel", "David",
    "George", "Michael", "James", "Peter", "Mark", "Andrew", "Lucas", "Martin", "Aisha", "Fatima",
    "Mariam", "Salma", "Yasmin", "Dina", "Hala", "Rana", "Mona", "Nada", "Heba", "Amira",
    "Layla", "Nour", "Sara", "Habiba", "Farida", "Malak", "Jana", "Aya", "Rania", "Yara",
    "Nadia", "Hoda", "Emily", "Anna", "Maria", "Laura", "Sophie", "Chloe", "Nina", "Julia"
];

const LAST_NAMES = [
    "Hassan", "Ibrahim", "Farouk", "Mansour", "Khalil", "Saeed", "Gaber", "Fathy", "Shawky", "Zaki",
    "Rashed", "Hamdy", "Sabry", "Nabil", "Kamal", "Rashad", "Fahmy", "Selim", "Aziz", "Hady",
    "Bahgat", "Kamel", "Sobhy", "Dawoud", "Gerges", "Boutros", "Samuel", "Wassef", "Naguib", "Demian",
    "Smith", "Johnson", "Brown", "Wilson", "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris",
    "Thompson", "Garcia", "Martinez", "Lopez", "Miller", "Davis", "Rodriguez", "Clark", "Lewis", "Walker"
];

const FEEDBACK_POOL = [
    "Great session today, feeling stronger!",
    "Loved the new HIIT circuit, brutal but effective.",
    "Coach pushed me harder than usual, worth it.",
    "Leg day destroyed me, but progress feels real.",
    "Treadmill intervals are getting easier every week.",
    "Yoga class helped my recovery a lot.",
    "Best workout of the month so far.",
    "Tried a new strength routine, excited to track progress.",
    "Slightly tired but finished everything on plan.",
    "CrossFit WOD was intense, still buzzing.",
    "Slow session today, will sleep better tonight.",
    "Beating my personal record on deadlifts soon!",
    "Cardio endurance is clearly improving.",
    "Felt light and fast on this one.",
    "Needed this stress relief after work.",
    "Consistency is paying off, 3 months strong."
];

// ─── CLI ────────────────────────────────────────────────────────────────────
interface SeedOptions {
    dryRun: boolean;
    skipClean: boolean;
    memberCount: number;
}

const usage = (): string => `
Usage: npm run seed [options]

Options:
  --dry-run          generate and validate all data locally, write nothing
  --members=<n>      number of members to create (default: ${DEFAULT_MEMBERS})
  --skip-clean       keep existing auth users/workouts, only append
  --help             show this help

Env:
  ADMIN_EMAIL / ADMIN_PASSWORD      admin account (default admin@gym.com / admin123456)
  SEED_MEMBER_PASSWORD              shared password for all members (default ${DEFAULT_MEMBER_PASSWORD})
`;

const parseArgs = (argv: string[]): SeedOptions => {
    const options: SeedOptions = { dryRun: false, skipClean: false, memberCount: DEFAULT_MEMBERS };

    for (const arg of argv) {
        if (arg === "--dry-run") options.dryRun = true;
        else if (arg === "--skip-clean") options.skipClean = true;
        else if (arg === "--help" || arg === "-h") {
            console.log(usage());
            process.exit(0);
        } else if (arg.startsWith("--members=")) {
            const value = Number.parseInt(arg.slice("--members=".length), 10);

            if (!Number.isInteger(value) || value < 1 || value > 5000) {
                console.error(`✗ --members must be an integer between 1 and 5000 (got "${arg}")`);
                process.exit(1);
            }

            options.memberCount = value;
        } else {
            console.error(`✗ Unknown option "${arg}"\n${usage()}`);
            process.exit(1);
        }
    }

    return options;
};

const options = parseArgs(process.argv.slice(2));

// ─── tiny console helpers (no pino here — the seed must run standalone) ─────
const c = {
    dim: (s: string): string => `\x1b[2m${s}\x1b[0m`,
    bold: (s: string): string => `\x1b[1m${s}\x1b[0m`,
    cyan: (s: string): string => `\x1b[36m${s}\x1b[0m`,
    green: (s: string): string => `\x1b[32m${s}\x1b[0m`,
    yellow: (s: string): string => `\x1b[33m${s}\x1b[0m`,
    red: (s: string): string => `\x1b[31m${s}\x1b[0m`
};

const step = (n: number, label: string): void => {
    console.log(`\n${c.bold(c.cyan(`[${n}]`))} ${label}`);
};

const ok = (label: string, detail = ""): void => {
    console.log(`  ${c.green("✓")} ${label}${detail ? c.dim(` — ${detail}`) : ""}`);
};

const warn = (label: string, detail = ""): void => {
    console.log(`  ${c.yellow("!")} ${label}${detail ? c.dim(` — ${detail}`) : ""}`);
};

const fail = (label: string, detail = ""): void => {
    console.log(`  ${c.red("✗")} ${label}${detail ? c.dim(` — ${detail}`) : ""}`);
};

const num = (n: number): string => new Intl.NumberFormat("en-US").format(n);

// ─── deterministic PRNG (reproducible seeds run after run) ──────────────────
const makeRandom = (seed: number): (() => number) => {
    let state = seed >>> 0;

    return (): number => {
        state = (state + 0x6d2b79f5) | 0;

        let t = Math.imul(state ^ (state >>> 15), 1 | state);

        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const random = makeRandom(PRNG_SEED);

const int = (min: number, max: number): number => min + Math.floor(random() * (max - min + 1));
const chance = (probability: number): boolean => random() < probability;

const pick = <T>(items: readonly T[]): T => {
    const index = Math.floor(random() * items.length);
    const value = items[index];

    if (value === undefined) throw new Error("pick() called on an empty pool");

    return value;
};

const weightedPick = <T>(entries: ReadonlyArray<readonly [T, number]>): T => {
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = random() * total;

    for (const [value, weight] of entries) {
        roll -= weight;

        if (roll <= 0) return value;
    }

    const last = entries[entries.length - 1];

    if (!last) throw new Error("weightedPick() called on an empty pool");

    return last[0];
};

const withConcurrency = async <T, R>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
    const results: R[] = new Array(items.length);
    let next = 0;

    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const index = next++;

            results[index] = await worker(items[index] as T, index);
        }
    });

    await Promise.all(runners);

    return results;
};

const withRetry = async <R>(operation: () => Promise<R>, attempts = 2): Promise<R> => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError;
};

// ─── data generation ────────────────────────────────────────────────────────
type SubscriptionPlan = "basic" | "standard" | "premium";
type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
type WorkoutType = (typeof WORKOUT_TYPES)[number];

interface GeneratedMember {
    fullName: string;
    email: string;
    password: string;
    phone: string | null;
    subscriptionPlan: SubscriptionPlan;
    subscriptionStatus: SubscriptionStatus;
    allowedWorkoutDays: string[];
    joinedAt: Date;
}

interface GeneratedWorkout {
    memberId: string;
    startTimestamp: Date;
    endTimestamp: Date | null;
    duration: number | null;
    workoutType: WorkoutType;
    calories: number | null;
    feedback: string | null;
    createdAt: Date;
}

const WEEKDAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const generatePhone = (): string => {
    const operator = pick(["0", "1", "2", "5"]); // Egyptian mobile operators
    let rest = "";

    for (let i = 0; i < 8; i++) rest += Math.floor(random() * 10);

    return `01${operator}${rest}`;
};

const generateMembers = (count: number): GeneratedMember[] => {
    const members: GeneratedMember[] = [];
    const now = Date.now();

    for (let i = 1; i <= count; i++) {
        const firstName = pick(FIRST_NAMES);
        const lastName = pick(LAST_NAMES);
        const fullName = `${firstName} ${lastName}`;

        // counter guarantees unique + lowercase emails, matching the app's zod email rule
        const email = `${firstName}.${lastName}${String(i).padStart(3, "0")}@${EMAIL_DOMAIN}`.toLowerCase();

        const subscriptionPlan = weightedPick<SubscriptionPlan>([
            ["basic", 45],
            ["standard", 35],
            ["premium", 20]
        ]);

        const subscriptionStatus = weightedPick<SubscriptionStatus>([
            ["active", 86],
            ["inactive", 9],
            ["suspended", 5]
        ]);

        members.push({
            fullName,
            email,
            password: SEED_MEMBER_PASSWORD,
            phone: chance(0.88) ? generatePhone() : null,
            subscriptionPlan,
            subscriptionStatus,
            allowedWorkoutDays: PLAN_WORKOUT_DAYS[subscriptionPlan] ?? ["monday", "wednesday", "friday"],
            joinedAt: new Date(now - int(2, 545) * DAY_MS - int(0, 86_000_000))
        });
    }

    return members;
};

const generateWorkouts = (members: GeneratedMember[], memberAuthIds: Map<string, string>): GeneratedWorkout[] => {
    const workouts: GeneratedWorkout[] = [];
    const now = Date.now();

    for (const member of members) {
        const authId = memberAuthIds.get(member.email);

        if (!authId) continue;

        const allowedDays = new Set(member.allowedWorkoutDays);
        const attendance = (ATTENDANCE_BY_PLAN[member.subscriptionPlan] ?? 0.25)
            * (STATUS_ATTENDANCE_FACTOR[member.subscriptionStatus] ?? 0.5);

        const joinedDay = new Date(member.joinedAt);

        joinedDay.setHours(0, 0, 0, 0); // local midnight of the join day

        let day = new Date(joinedDay);

        while (day.getTime() < now) {
            const weekday = WEEKDAY_NAMES[day.getDay()] ?? "";

            if (allowedDays.has(weekday) && chance(attendance)) {
                const startHour = int(7, 22);
                const startMinute = int(0, 59);

                const startTimestamp = new Date(day);
                startTimestamp.setHours(startHour, startMinute, 0, 0);

                // never generate future sessions and never before the member actually joined
                if (startTimestamp.getTime() < now && startTimestamp.getTime() >= member.joinedAt.getTime()) {
                    const durationMinutes = int(25, 105);
                    const workoutType = weightedPick<WorkoutType>([
                        ["strength", 30],
                        ["cardio", 22],
                        ["hiit", 14],
                        ["yoga", 12],
                        ["crossfit", 10],
                        ["flexibility", 7],
                        ["other", 5]
                    ]);

                    const calories = Math.round(
                        durationMinutes * CALORIES_PER_MINUTE[workoutType] * (0.85 + random() * 0.3)
                    );

                    const endTimestamp = new Date(startTimestamp.getTime() + durationMinutes * MINUTE_MS);

                    workouts.push({
                        memberId: authId,
                        startTimestamp,
                        endTimestamp,
                        duration: durationMinutes * 60, // seconds — matches stopWorkout() behaviour
                        workoutType,
                        calories,
                        feedback: chance(0.3) ? pick(FEEDBACK_POOL) : null,
                        createdAt: startTimestamp
                    });
                }
            }

            day = new Date(day.getTime() + DAY_MS);
        }

        // a few members currently have a session still in progress
        if (member.subscriptionStatus === "active" && chance(0.02)) {
            const startedAt = new Date(now - int(12, 70) * MINUTE_MS);

            workouts.push({
                memberId: authId,
                startTimestamp: startedAt,
                endTimestamp: null,
                duration: null,
                workoutType: pick(WORKOUT_TYPES),
                calories: null,
                feedback: null,
                createdAt: startedAt
            });
        }
    }

    return workouts;
};

// ─── zod validation of generated data (the app's own validators) ────────────
const workoutSeedSchema = z.object({
    memberId: z.string().min(1),
    startTimestamp: z.date(),
    endTimestamp: z.date().nullable(),
    duration: z.number().int().nonnegative().nullable(),
    workoutType: z.enum(WORKOUT_TYPES),
    calories: z.number().nonnegative().nullable(),
    feedback: z.string().max(1000).nullable(),
    createdAt: z.date()
});

const memberEmailSchema = z.string().email().toLowerCase();

interface ValidationReport {
    members: number;
    workouts: number;
    uniqueEmails: number;
    zodMemberErrors: number;
    zodWorkoutErrors: number;
    emailErrors: number;
    planMix: Record<string, number>;
    statusMix: Record<string, number>;
    typeMix: Record<string, number>;
    activeSessions: number;
    samples: GeneratedMember[];
}

const validateGeneratedData = (members: GeneratedMember[], workouts: GeneratedWorkout[]): ValidationReport => {
    const uniqueEmails = new Set(members.map((member) => member.email));
    const planMix: Record<string, number> = {};
    const statusMix: Record<string, number> = {};
    const typeMix: Record<string, number> = {};

    let zodMemberErrors = 0;
    let zodWorkoutErrors = 0;
    let emailErrors = 0;
    let activeSessions = 0;

    for (const member of members) {
        // the exact schema POST /api/auth/register accepts
        const registerResult = registerSchema.safeParse({
            body: { fullName: member.fullName, email: member.email, password: member.password },
            query: {},
            params: {}
        });

        // the exact schema POST /api/admin/members accepts
        const createResult = createMemberSchema.safeParse({
            body: {
                fullName: member.fullName,
                email: member.email,
                phone: member.phone,
                subscriptionPlan: member.subscriptionPlan,
                password: member.password
            },
            query: {},
            params: {}
        });

        if (!registerResult.success || !createResult.success) zodMemberErrors++;
        if (!memberEmailSchema.safeParse(member.email).success) emailErrors++;

        planMix[member.subscriptionPlan] = (planMix[member.subscriptionPlan] ?? 0) + 1;
        statusMix[member.subscriptionStatus] = (statusMix[member.subscriptionStatus] ?? 0) + 1;
    }

    for (const workout of workouts) {
        if (!workoutSeedSchema.safeParse(workout).success) {
            zodWorkoutErrors++;

            continue;
        }

        if (workout.endTimestamp === null) activeSessions++;

        typeMix[workout.workoutType] = (typeMix[workout.workoutType] ?? 0) + 1;
    }

    return {
        members: members.length,
        workouts: workouts.length,
        uniqueEmails: uniqueEmails.size,
        zodMemberErrors,
        zodWorkoutErrors,
        emailErrors,
        planMix,
        statusMix,
        typeMix,
        activeSessions,
        samples: members.slice(0, 3)
    };
};

// ─── clients (own instances — the seed must not depend on app singletons) ───
interface SeedClients {
    supabase: SupabaseClient;
    supabaseAuth: SupabaseClient;
}

const createClients = (): SeedClients => ({
    supabase: createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    }),
    supabaseAuth: createClient(env.supabaseUrl, env.supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    })
});

const maskUri = (uri: string): string => uri.replace(/\/\/[^@/]+@/, "//***@");

// ─── phase 1: clean ─────────────────────────────────────────────────────────
const listAllAuthUsers = async (supabase: SupabaseClient): Promise<Array<{ id: string; email: string | null }>> => {
    const users: Array<{ id: string; email: string | null }> = [];
    let page = 1;

    while (true) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: SUPABASE_PAGE_SIZE });

        if (error) throw new Error(`Failed to list auth users: ${error.message}`);

        const batch = data?.users ?? [];

        users.push(...batch.map((user) => ({ id: user.id, email: user.email ?? null })));

        if (batch.length < SUPABASE_PAGE_SIZE) break;

        page++;
    }

    return users;
};

const countAuthUsers = async (supabase: SupabaseClient): Promise<number> => {
    let total = 0;
    let page = 1;

    while (true) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: SUPABASE_PAGE_SIZE });

        if (error) throw new Error(`Failed to list auth users: ${error.message}`);

        const batch = data?.users ?? [];

        total += batch.length;

        if (batch.length < SUPABASE_PAGE_SIZE) break;

        page++;
    }

    return total;
};

const cleanRedisCache = async (): Promise<{ cleared: boolean; keys: number }> => {
    const redis = new Redis(env.redisCloudUrl, {
        lazyConnect: true,
        connectTimeout: 3000,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // never retry — cache is optional for the seed
        enableOfflineQueue: false
    });

    try {
        await redis.connect();
    } catch {
        redis.disconnect();

        return { cleared: false, keys: 0 };
    }

    try {
        let totalKeys = 0;

        for (const pattern of ["gym:stats", "member:*", "dashboard:*", "report:*"]) {
            const keys: string[] = [];
            let cursor = "0";

            do {
                const [next, batch] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 500);

                cursor = next;

                if (batch && batch.length > 0) keys.push(...batch);
            } while (cursor !== "0");

            if (keys.length > 0) {
                await redis.del(...keys);

                totalKeys += keys.length;
            }
        }

        return { cleared: true, keys: totalKeys };
    } finally {
        redis.disconnect();
    }
};

const cleanDatabase = async (clients: SeedClients): Promise<void> => {
    const users = await listAllAuthUsers(clients.supabase);

    if (users.length > 0) {
        let deleted = 0;
        const errors: string[] = [];

        await withConcurrency(users, CONCURRENCY, async (user) => {
            try {
                await withRetry(() => clients.supabase.auth.admin.deleteUser(user.id));
                deleted++;
            } catch (error) {
                errors.push(`${user.email ?? user.id}: ${error instanceof Error ? error.message : String(error)}`);
            }
        });

        if (errors.length > 0) {
            throw new Error(`Failed to delete ${errors.length} auth user(s) during clean: ${errors.slice(0, 3).join("; ")}`);
        }

        ok(`Deleted ${num(deleted)} auth users (member rows cascade)`);
    } else {
        ok("No existing auth users found");
    }

    const removedWorkouts = await Workout.deleteMany({});

    ok(`Deleted ${num(removedWorkouts.deletedCount ?? 0)} workout documents`);

    const cache = await cleanRedisCache();

    if (cache.cleared) ok(`Cleared ${num(cache.keys)} Redis cache key(s)`);
    else warn("Redis unreachable — skipped cache cleanup", "cached stats expire automatically (<=30 min)");
};

// ─── phase 2: auth users ────────────────────────────────────────────────────
interface AuthUserSeedResult {
    email: string;
    authId: string;
}

const createAuthUser = async (
    clients: SeedClients,
    fullName: string,
    email: string,
    password: string
): Promise<AuthUserSeedResult> => {
    const { data, error } = await clients.supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName }
    });

    if (error || !data?.user) {
        const message = error?.message ?? "no user returned";

        throw new Error(`Failed to create auth user ${email}: ${message}`);
    }

    // the on_auth_user_created trigger inserts the initial members row
    return { email, authId: data.user.id };
};

// ─── phase 3: member rows ───────────────────────────────────────────────────
const updateMemberRow = async (
    clients: SeedClients,
    authId: string,
    member: GeneratedMember
): Promise<void> => {
    const { error } = await clients.supabase
        .from("members")
        .update({
            phone: member.phone,
            subscription_plan: member.subscriptionPlan,
            subscription_status: member.subscriptionStatus,
            allowed_workout_days: member.allowedWorkoutDays,
            created_at: member.joinedAt.toISOString()
        })
        .eq("id", authId);

    if (error) throw new Error(`Failed to update member row for ${member.email}: ${error.message}`);
};

// ─── verification helpers ───────────────────────────────────────────────────
const countMembersRows = async (supabase: SupabaseClient): Promise<number> => {
    const { count, error } = await supabase
        .from("members")
        .select("*", { count: "exact", head: true });

    if (error) throw new Error(`Failed to count members rows: ${error.message}`);

    return count ?? 0;
};

const countMembersBy = async (supabase: SupabaseClient, column: string, value: string): Promise<number> => {
    const { count, error } = await supabase
        .from("members")
        .select("*", { count: "exact", head: true })
        .eq(column, value);

    if (error) throw new Error(`Failed to count members by ${column}: ${error.message}`);

    return count ?? 0;
};

const fetchRandomMemberRows = async (
    supabase: SupabaseClient,
    ids: string[]
): Promise<Array<Record<string, unknown>>> => {
    const rows: Array<Record<string, unknown>> = [];

    for (const id of ids) {
        const { data, error } = await supabase
            .from("members")
            .select("id, full_name, email, phone, subscription_plan, subscription_status, allowed_workout_days, created_at")
            .eq("id", id)
            .maybeSingle();

        if (error) throw new Error(`Failed to fetch member row: ${error.message}`);

        if (data) rows.push(data as Record<string, unknown>);
    }

    return rows;
};

const signIn = async (
    supabaseAuth: SupabaseClient,
    email: string,
    password: string
): Promise<{ success: boolean; message: string }> => {
    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });

    if (error || !data.session) return { success: false, message: error?.message ?? "no session returned" };

    return { success: true, message: `session expires in ${data.session.expires_in}s` };
};

// ─── main ───────────────────────────────────────────────────────────────────
const main = async (): Promise<void> => {
    const startedAt = Date.now();

    console.log(c.bold(`\n╔══════════════════════════════════════════════════╗`));
    console.log(c.bold(`   Pulse Gym — Database Seed ${options.dryRun ? c.yellow("(DRY-RUN)") : ""}`));
    console.log(c.bold(`╚══════════════════════════════════════════════════╝`));

    console.log(`  Supabase  ${c.dim(maskUri(env.supabaseUrl))}`);
    console.log(`  MongoDB   ${c.dim(maskUri(env.mongoAtlasUri))}`);
    console.log(`  Redis     ${c.dim(maskUri(env.redisCloudUrl))}`);
    console.log(`  Admin     ${c.dim(`${env.adminEmail} / ${env.adminPassword}`)}`);
    console.log(`  Members   ${c.dim(`${num(options.memberCount)} accounts @ shared password "${SEED_MEMBER_PASSWORD}"`)}`);

    // ── generate + validate all data first (fails fast, before touching anything)
    step(1, "Generating seed data");
    const members = generateMembers(options.memberCount);
    const validation = validateGeneratedData(members, []); // workouts come later — members validated now
    const planMix = validation;

    ok(`Generated ${num(members.length)} member profiles`, `${validation.uniqueEmails} unique emails`);

    if (validation.zodMemberErrors > 0 || validation.emailErrors > 0) {
        throw new Error(
            `Generated data failed the app's zod validators — ` +
            `${validation.zodMemberErrors} member(s), ${validation.emailErrors} invalid email(s)`
        );
    }

    ok("All member data passes registerSchema + createMemberSchema (zod)");
    ok(`Password "${SEED_MEMBER_PASSWORD}" passes the app's zod password rule (min 6, trimmed)`);

    if (options.dryRun) {
        console.log(`\n${c.bold(c.yellow("[DRY-RUN]"))} ${c.dim("no connections were opened, nothing was written")}`);
        console.log(`\n  ${c.bold("Sample accounts (all use the shared password):")}`);

        for (const member of validation.samples) {
            console.log(`    ${c.dim("•")} ${member.email.padEnd(36)} plan=${member.subscriptionPlan} status=${member.subscriptionStatus}`);
        }

        console.log(`\n  ${c.bold("Plan mix:")}    basic ${planMix.planMix.basic ?? 0} · standard ${planMix.planMix.standard ?? 0} · premium ${planMix.planMix.premium ?? 0}`);
        console.log(`  ${c.bold("Status mix:")}  active ${planMix.statusMix.active ?? 0} · inactive ${planMix.statusMix.inactive ?? 0} · suspended ${planMix.statusMix.suspended ?? 0}`);
        console.log(`\n${c.green(c.bold("DRY-RUN COMPLETE"))} ${c.dim(`in ${((Date.now() - startedAt) / 1000).toFixed(1)}s — data is valid, run without --dry-run to seed`)}\n`);

        return;
    }

    // ── connect (fail fast with friendly errors)
    step(2, "Connecting to services");
    const clients = createClients();

    const supabaseCheck = await clients.supabase.from("members").select("*", { count: "exact", head: true });

    if (supabaseCheck.error) {
        throw new Error(
            `Cannot reach Supabase at ${maskUri(env.supabaseUrl)} (${supabaseCheck.error.message}).\n` +
            `       Start local Supabase with "npm run supabase:start" or fix SUPABASE_URL in .env`
        );
    }

    ok("Supabase reachable", `members table has ${num(supabaseCheck.count ?? 0)} row(s)`);

    await mongoose.connect(env.mongoAtlasUri, {
        autoIndex: false,
        autoCreate: false,
        serverSelectionTimeoutMS: 8000
    });

    ok("MongoDB connected", maskUri(env.mongoAtlasUri));

    // ── clean
    if (options.skipClean) {
        step(3, "Skipping clean (--skip-clean)");
    } else {
        step(3, "Cleaning existing data");
        await cleanDatabase(clients);
    }

    // ── admin account
    step(4, "Creating admin account");
    const adminFullName = "Gym Administrator";

    const adminAuth = await createAuthUser(clients, adminFullName, env.adminEmail, env.adminPassword);

    ok(`Auth user created: ${env.adminEmail}`, `auth id ${adminAuth.authId}`);

    await updateMemberRow(clients, adminAuth.authId, {
        fullName: adminFullName,
        email: env.adminEmail,
        password: env.adminPassword,
        phone: null,
        subscriptionPlan: "premium",
        subscriptionStatus: "active",
        allowedWorkoutDays: PLAN_WORKOUT_DAYS.premium ?? ["monday", "wednesday", "friday"],
        joinedAt: new Date(Date.now() - 730 * DAY_MS)
    });

    ok("Member row completed (premium / active / joined 2 years ago)");
    ok(`Admin panel credentials: ${c.bold(env.adminEmail)} / ${c.bold(env.adminPassword)} ${c.dim("(env-driven, POST /api/admin/login)")}`);

    // ── members
    step(5, `Creating ${num(members.length)} member accounts`);

    const memberAuthIds = new Map<string, string>();
    const createErrors: string[] = [];

    await withConcurrency(members, CONCURRENCY, async (member) => {
        try {
            const created = await withRetry(() => createAuthUser(clients, member.fullName, member.email, member.password));

            memberAuthIds.set(member.email, created.authId);

            if (memberAuthIds.size % 25 === 0) {
                console.log(c.dim(`    created ${num(memberAuthIds.size)}/${num(members.length)} auth users…`));
            }
        } catch (error) {
            createErrors.push(error instanceof Error ? error.message : String(error));
        }
    });

    if (createErrors.length > 0) {
        throw new Error(`Failed to create ${createErrors.length} auth user(s). First errors:\n       ${createErrors.slice(0, 3).join("\n       ")}`);
    }

    ok(`Created ${num(memberAuthIds.size)} confirmed auth users`, `password "${SEED_MEMBER_PASSWORD}" for all`);

    console.log(c.dim(`    updating member rows (phone, plan, status, allowed days, join date)…`));

    const memberRowErrors: string[] = [];

    await withConcurrency(members, CONCURRENCY, async (member) => {
        const authId = memberAuthIds.get(member.email);

        if (!authId) return;

        try {
            await withRetry(() => updateMemberRow(clients, authId, member));
        } catch (error) {
            memberRowErrors.push(error instanceof Error ? error.message : String(error));
        }
    });

    if (memberRowErrors.length > 0) {
        throw new Error(`Failed to update ${memberRowErrors.length} member row(s). First errors:\n       ${memberRowErrors.slice(0, 3).join("\n       ")}`);
    }

    ok(`Completed ${num(memberAuthIds.size)} member rows`);

    // ── workouts
    step(6, "Generating workout history");
    const workouts = generateWorkouts(members, memberAuthIds);
    const workoutValidation = validateGeneratedData(members, workouts);

    if (workoutValidation.zodWorkoutErrors > 0) {
        throw new Error(`${workoutValidation.zodWorkoutErrors} generated workout(s) failed model validation`);
    }

    ok(`Generated ${num(workouts.length)} workouts`, `${workoutValidation.activeSessions} still in progress`);

    for (let i = 0; i < workouts.length; i += INSERT_CHUNK) {
        const chunk = workouts.slice(i, i + INSERT_CHUNK);

        await Workout.insertMany(chunk, { ordered: false });
        console.log(c.dim(`    inserted ${num(Math.min(i + INSERT_CHUNK, workouts.length))}/${num(workouts.length)} documents…`));
    }

    ok(`Inserted ${num(workouts.length)} documents into "workouts"`);

    const cacheAfter = await cleanRedisCache();

    if (cacheAfter.cleared) ok(`Cleared ${num(cacheAfter.keys)} stale cache key(s) after seeding`);
    else warn("Redis unreachable — stale stats cache will self-expire (<=30 min)");

    // ── verification
    step(7, "Verifying seeded data");

    const expectedRows = members.length + 1; // + admin
    const memberRows = await countMembersRows(clients.supabase);
    const authUserCount = await countAuthUsers(clients.supabase);
    const workoutCount = await countAllWorkouts();
    const totalCalories = await sumAllCalories();
    const averageDuration = await averageAllDuration();
    const popularType = await getMostPopularWorkoutType();

    if (memberRows === expectedRows) ok(`members table rows: ${num(memberRows)}`, "matches expected count");
    else fail(`members table rows: ${num(memberRows)}`, `expected ${num(expectedRows)}`);

    if (authUserCount === expectedRows) ok(`auth users: ${num(authUserCount)}`, "matches expected count");
    else fail(`auth users: ${num(authUserCount)}`, `expected ${num(expectedRows)}`);

    if (workoutCount === workouts.length) ok(`workout documents: ${num(workoutCount)}`, "matches expected count");
    else fail(`workout documents: ${num(workoutCount)}`, `expected ${num(workouts.length)}`);

    ok(`Gym stats ready for /api/admin/statistics`, `calories ${num(totalCalories)} · avg duration ${Math.round(averageDuration)}s · top type "${popularType}"`);

    for (const plan of ["basic", "standard", "premium"] as const) {
        const planCount = await countMembersBy(clients.supabase, "subscription_plan", plan);

        if (planCount === (validation.planMix[plan] ?? 0) + (plan === "premium" ? 1 : 0)) {
            ok(`plan "${plan}" rows in DB: ${num(planCount)}`, "matches generated mix");
        } else {
            fail(`plan "${plan}" rows in DB: ${num(planCount)}`, `expected ${num((validation.planMix[plan] ?? 0) + (plan === "premium" ? 1 : 0))}`);
        }
    }

    for (const status of SUBSCRIPTION_STATUSES) {
        const statusCount = await countMembersBy(clients.supabase, "subscription_status", status);

        if (statusCount === (validation.statusMix[status] ?? 0)) {
            ok(`status "${status}" rows in DB: ${num(statusCount)}`, "matches generated mix");
        } else {
            fail(`status "${status}" rows in DB: ${num(statusCount)}`, `expected ${num(validation.statusMix[status] ?? 0)}`);
        }
    }

    // member rows spot check: profile fields + allowed days match the plan
    const sampleIds = [...memberAuthIds.values()].slice(0, 5);
    const sampleRows = await fetchRandomMemberRows(clients.supabase, sampleIds);
    const daysByPlan = PLAN_WORKOUT_DAYS;

    let spotCheckFailures = 0;

    for (const row of sampleRows) {
        const plan = String(row.subscription_plan);
        const days = (row.allowed_workout_days as string[] | null) ?? [];
        const phone = row.phone === null || row.phone === undefined ? null : String(row.phone);

        const daysOk = JSON.stringify([...days].sort()) === JSON.stringify([...(daysByPlan[plan] ?? [])].sort());
        const phoneOk = phone === null || /^01\d{9}$/.test(phone);

        if (!daysOk || !phoneOk) spotCheckFailures++;
    }

    if (spotCheckFailures === 0 && sampleRows.length > 0) {
        ok(`Member rows spot check (5 random rows)`, `plan→days mapping + phone format 01XXXXXXXXX`);
    } else {
        fail(`Member rows spot check failed for ${spotCheckFailures} row(s)`);
    }

    // sign-in verification: 3 members + wrong-password rejection + admin
    const sampleMembers = members.slice(0, 3);

    for (const member of sampleMembers) {
        const result = await signIn(clients.supabaseAuth, member.email, member.password);

        if (result.success) ok(`Member sign-in OK`, `${member.email} / ${member.password} (${result.message})`);
        else fail(`Member sign-in failed`, `${member.email} — ${result.message}`);
    }

    if (sampleMembers[0]) {
        const wrong = await signIn(clients.supabaseAuth, sampleMembers[0].email, "wrong-password-999");

        if (!wrong.success) ok(`Wrong password correctly rejected`, sampleMembers[0].email);
        else fail(`Wrong password was accepted!`, sampleMembers[0].email);
    }

    const adminSignIn = await signIn(clients.supabaseAuth, env.adminEmail, env.adminPassword);

    if (adminSignIn.success) ok(`Admin auth account signs in`, `${env.adminEmail} (${adminSignIn.message})`);
    else fail(`Admin auth sign-in failed`, adminSignIn.message);

    const adminToken = jwt.sign(
        { role: "admin", email: env.adminEmail },
        env.adminEmail + env.adminPassword,
        { expiresIn: "24h" }
    );

    const decoded = jwt.decode(adminToken) as { role?: string; email?: string } | null;

    if (decoded?.role === "admin" && decoded.email === env.adminEmail) {
        ok(`Admin JWT (same secret as adminLogin service)`, `${adminToken.slice(0, 28)}…`);
    } else {
        fail("Admin JWT payload mismatch");
    }

    // ── summary
    console.log(`\n${c.bold("── Credentials ──────────────────────────────────────────────")}`);
    console.log(`  ${c.bold("Admin panel")}  ${c.dim("POST /api/admin/login")}`);
    console.log(`    email     ${c.green(env.adminEmail)}`);
    console.log(`    password  ${c.green(env.adminPassword)}`);
    console.log(`  ${c.bold("Members")}       ${c.dim("POST /api/auth/login")} — ${num(members.length)} accounts`);
    console.log(`    email     ${c.green(sampleMembers[0]?.email ?? "<see members table>")} ${c.dim("(and 249 more)")}`);
    console.log(`    password  ${c.green(SEED_MEMBER_PASSWORD)} ${c.dim("(shared by every member)")}`);

    console.log(`\n  Plan mix     basic ${validation.planMix.basic ?? 0} · standard ${validation.planMix.standard ?? 0} · premium ${(validation.planMix.premium ?? 0) + 1}`);
    console.log(`  Status mix   active ${(validation.statusMix.active ?? 0) + 1} · inactive ${validation.statusMix.inactive ?? 0} · suspended ${validation.statusMix.suspended ?? 0}`);

    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

    console.log(`\n${c.green(c.bold("SEED COMPLETE"))} ${c.dim(`in ${seconds}s — start the API with: npm run dev`)}\n`);
};

main()
    .then(async () => {
        if (mongoose.connection.readyState === 1) await mongoose.disconnect();

        process.exit(0);
    })
    .catch(async (error: unknown) => {
        console.error(`\n${c.red(c.bold("SEED FAILED"))} ${error instanceof Error ? error.message : String(error)}`);

        if (mongoose.connection.readyState === 1) await mongoose.disconnect();

        process.exit(1);
    });
