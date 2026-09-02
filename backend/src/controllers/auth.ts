import type { Request, Response, NextFunction } from "express";
import * as authService from "../services/auth.js";
import { accessCookieOptions, refreshCookieOptions } from "../config/cookies.js";

export const register = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        await authService.register(req.body.fullName, req.body.email, req.body.password);

        res.status(201).json({ success: true });
    } catch (error) {
        next(error);
    }
};

export const login = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { user, accessToken, refreshToken, expiresIn } = await authService.login(req.body.email, req.body.password);

        res.cookie("accessToken", accessToken, accessCookieOptions(expiresIn));
        res.cookie("refreshToken", refreshToken, refreshCookieOptions);

        res.status(200).json({
            message: "Login successful.",
            user: {
                id: user.id,
                fullName: user.full_name,
                email: user.email,
                subscriptionPlan: user.subscription_plan,
                subscriptionStatus: user.subscription_status
            }
        });
    } catch (error) {
        next(error);
    }
};

export const logout = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const accessToken = req.cookies.accessToken;

        if (accessToken) await authService.logout(accessToken);

        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");

        res.status(200).json({ message: "Logout successful." });
    } catch (error) {
        next(error);
    }
};

export const refresh = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const refreshToken = req.cookies.refreshToken;

        const result = await authService.refreshSession(refreshToken);

        res.cookie("accessToken", result.accessToken, accessCookieOptions(result.expiresIn));
        res.cookie("refreshToken", result.refreshToken, refreshCookieOptions);

        res.status(200).json({ message: "token has been refreshed" });
    } catch (error) {
        next(error);
    }
};
