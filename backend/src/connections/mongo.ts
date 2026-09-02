import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
});

mongoose.connection.on("error", (error: Error) => {
    logger.error({ err: error }, "MongoDB error");
});

export const connectMongo = async (): Promise<void> => {
    await mongoose.connect(env.mongoAtlasUri, {
        autoIndex: false,
        autoCreate: false   
    });

    logger.info("MongoDB (Atlas) connected");
};