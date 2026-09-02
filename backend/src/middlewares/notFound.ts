import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../errors/HttpError.js";

export const notFound = (
    req: Request, 
    res: Response, 
    next: NextFunction
): void => {
    next(new HttpError(404, `route: "${req.originalUrl}" not found`));
};
