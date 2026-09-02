import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../errors/HttpError.js";
import { getSupabaseUser } from "../repositories/auth.js";
import { fetchMemberById } from "../repositories/members.js";
import { env } from "../config/env.js";
import jwt from "jsonwebtoken";

export const authenticateToken = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const token = req.cookies.accessToken;

        if (!token) throw new HttpError(401, "access denied, please log in first");

        const { user, error } = await getSupabaseUser(token);

        if (error || !user) throw new HttpError(401, "invalid token");

        const member = await fetchMemberById(user.id);

        if (!member) throw new HttpError(401, "invalid token");

        const payload = {
            id: member.id,
            fullName: member.full_name,
            email: member.email,
            role: "member" as const
        };

        req.user = payload

        next();
    } catch (error) {
        next(error);
    }
};

export const authenticateAdmin = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const token = req.cookies.adminAccessToken;

        if (!token) throw new HttpError(401, "access denied, admin login required");

        const decoded = jwt.verify(token, env.adminEmail + env.adminPassword) as { role: string };

        if (decoded.role !== "admin") throw new HttpError(403, "admin access required");

        req.user = { 
            id: "admin", 
            fullName: "Admin", 
            email: env.adminEmail, 
            role: "admin" 
        };

        next();
    } catch (error) {
        next(error);
    }
};