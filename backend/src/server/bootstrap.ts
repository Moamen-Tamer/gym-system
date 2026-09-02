import type { Server } from "node:http";
import { redis } from "../connections/redis.js";
import mongoose from "mongoose";
import { connectMongo } from "../connections/mongo.js";
import { app } from "./app.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { supabase } from "../connections/supabase.js";
import { HttpError } from "../errors/HttpError.js";

let server: Server | undefined;

async function closeConnection(): Promise<void> {
    logger.warn("Closing Connection...");

    if (server) {
        try{
            server.closeIdleConnections()

            await new Promise<void> ((resolve, reject) => {
                server!.close((error) => (error? reject(error) : resolve()));
            });
        } catch (error) {
            logger.error({ err: error }, "Error closing HTTP server");
        }
    }

    try { 
        await redis.quit(); 
    } catch (error) {
        logger.error({ err: error }, "Error closing Redis");
    }

    try { 
        await mongoose.disconnect(); 
    } catch (error) {
        logger.error({ err: error }, "Error closing MongoDB");
    }

    logger.info("All connections closed.");
};

async function shutdown(signal: string): Promise<void> {
  logger.warn(`${signal} received. Shutting down...`);
  await closeConnection();
  
  process.exit(0);
}

export async function startServer(): Promise<void> {
    try {
        await connectMongo();

        await redis.ping();

        const { error } = await supabase.from("members").select("*", { count: "exact", head: true });

        if (error) throw new HttpError(503, "Failed to establish a supabase connection.");

        logger.info("Supabase connected");

        server = app.listen(env.serverPort, () => {
            logger.info(`Server running on port ${env.serverPort}`);
        });
    } catch (error) {
        logger.error({ err: error }, "Startup failed");
        await closeConnection();

        process.exit(1);
    }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
