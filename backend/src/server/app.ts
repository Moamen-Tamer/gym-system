import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import helmet from "helmet";
import auth from "../routes/auth.js";
import members from "../routes/members.js";
import workouts from "../routes/workouts.js";
import dashboard from "../routes/dashboard.js";
import admin from "../routes/admin.js";
import reports from "../routes/reports.js";
import { authenticateToken, authenticateAdmin } from "../middlewares/authentication.js";
import { authorize, authorizeAdmin } from "../middlewares/authorization.js";
import { limiter } from "../middlewares/limiter.js";
import { logger } from "../middlewares/logger.js";
import { notFound } from "../middlewares/notFound.js";
import { errorHandler } from "../middlewares/error.js";

export const app: Express = express();

// body parser middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// general middlewares
app.use(helmet());
app.use(logger);

// limiter
app.use(limiter);

// routes
app.use('/api/auth', auth);
app.use('/api/members', authenticateToken, authorize, members);
app.use('/api/workouts', authenticateToken, authorize, workouts);
app.use('/api/dashboard', authenticateToken, authorize, dashboard);
app.use('/api/admin', admin);
app.use('/api/reports', authenticateAdmin, authorizeAdmin, reports);

// error handlers
app.use(notFound);
app.use(errorHandler);