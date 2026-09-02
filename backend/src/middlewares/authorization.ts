import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../errors/HttpError.js";

export const authorize = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    try {
        if (!req.user) throw new HttpError(401, "authentication required");
    
        next();
    } catch (error) {
        next(error);
    }
};

export const authorizeAdmin = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    try {
        if (!req.user) throw new HttpError(401, "authentication required");

        if (req.user.role !== "admin") throw new HttpError(403, "admin access required");
    
        next();
    } catch (error) {
        next(error);
    }
};