import type { Request, Response, NextFunction } from "express";
import * as dashboardService from "../services/dashboard.js";
import { HttpError } from "../errors/HttpError.js";

export const getDashboard = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user) throw new HttpError(401, "authentication required");

        const stats = await dashboardService.getDashboard(req.user.id);

        res.status(200).json({ ...stats });
    } catch (error) {
        next(error);
    }
};
