import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import helmet from "helmet";
import { logger } from "../middlewares/logger.js";

export const app: Express = express();

// body parser middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// general middlewares
app.use(helmet());
app.use(logger);