import type { Request, Response, NextFunction } from "express";
import * as memberService from "../services/members.js";

export const getAccount = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user) throw new Error("authentication required");

        const member = await memberService.getAccount(req.user.id);

        res.status(200).json({ member });
    } catch (error) {
        next(error);
    }
};

export const getSubscription = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user) throw new Error("authentication required");

        const member = await memberService.getSubscription(req.user.id);

        res.status(200).json({
            subscriptionPlan: member.subscription_plan,
            subscriptionStatus: member.subscription_status
        });
    } catch (error) {
        next(error);
    }
};

export const getWorkoutDays = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user) throw new Error("authentication required");

        const days = await memberService.getWorkoutDays(req.user.id);

        res.status(200).json({ allowedWorkoutDays: days });
    } catch (error) {
        next(error);
    }
};
