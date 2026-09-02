import e from "express";
import { z } from "zod";

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    SERVER_PORT: z.coerce.number().int().positive().default(3000),

    SUPABASE_URL: z.url("SUPABASE_URL must be a valid URL"),
    SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY is required"),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

    MONGO_ATLAS_URI: z.url("MONGO_ATLAS_URI must be a valid MongoDB connection string"),

    REDIS_CLOUD_URL: z.url("REDIS_URL must be a valid Redis connection string")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ` - ${issue.path.join('.')}: ${issue.message}`).join('\n');

    throw new Error(`Invalid environment variables:\n${issues}`);
};

export const env = {
    nodeEnv: parsed.data.NODE_ENV,
    serverPort: parsed.data.SERVER_PORT,

    supabaseUrl: parsed.data.SUPABASE_URL,
    supabaseAnonKey: parsed.data.SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY,

    mongoAtlas_Uri: parsed.data.MONGO_ATLAS_URI,

    redisCloudUrl: parsed.data.REDIS_CLOUD_URL
};