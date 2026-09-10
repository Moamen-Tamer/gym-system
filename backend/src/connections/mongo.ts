import dns from "node:dns";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

try {
    dns.setDefaultResultOrder?.("ipv4first");
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch { }

mongoose.set("bufferCommands", false);

mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
});

mongoose.connection.on("error", (error: Error) => {
    logger.error({ err: error }, "MongoDB error");
});

export const connectMongo = async (): Promise<void> => {
    await mongoose.connect(env.mongoAtlasUri, {
        autoIndex: false,
        autoCreate: false,
    });

    logger.info("MongoDB (Atlas) connected");
};