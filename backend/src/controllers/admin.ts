import type { Request, Response, NextFunction } from "express";
import * as adminService from "../services/admin.js";
import * as memberService from "../services/members.js";
import { accessCookieOptions } from "../config/cookies.js";

export const login = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { token } = await adminService.adminLogin(req.body.email, req.body.password);

        res.cookie("adminAccessToken", token, accessCookieOptions(86400));

        res.status(200).json({ message: "Admin login successful." });
    } catch (error) {
        next(error);
    }
};

export const listMembers = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const query = req.validated?.query as { page?: number; limit?: number } | undefined;

        const { members, total } = await memberService.listMembers(
            query?.page ?? 1,
            query?.limit ?? 20
        );

        res.status(200).json({ members, total, page: query?.page ?? 1, limit: query?.limit ?? 20 });
    } catch (error) {
        next(error);
    }
};

export const createMember = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const member = await memberService.createMember(
            req.body.fullName,
            req.body.email,
            req.body.phone ?? null,
            req.body.subscriptionPlan,
            req.body.password
        );

        res.status(201).json({ member });
    } catch (error) {
        next(error);
    }
};

export const updateMember = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const update: { full_name?: string; phone?: string | null; subscription_plan?: string } = {};

        if (req.body.fullName !== undefined) update.full_name = req.body.fullName;
        if (req.body.phone !== undefined) update.phone = req.body.phone;
        if (req.body.subscriptionPlan !== undefined) update.subscription_plan = req.body.subscriptionPlan;

        const member = await memberService.updateMemberById(req.params.id, update);

        res.status(200).json({ member });
    } catch (error) {
        next(error);
    }
};

export const deleteMember = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        await memberService.deleteMemberById(req.params.id);

        res.status(200).json({ message: "Member deleted successfully." });
    } catch (error) {
        next(error);
    }
};

export const changeSubscription = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const member = await memberService.changeMemberSubscription(req.params.id, req.body.subscriptionPlan);

        res.status(200).json({ member });
    } catch (error) {
        next(error);
    }
};

export const getMemberWorkouts = async (
    req: Request<{ memberId: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const query = req.validated?.query as { page?: number; limit?: number } | undefined;

        const result = await adminService.getMemberWorkoutHistory(
            req.params.memberId,
            query?.page ?? 1,
            query?.limit ?? 20
        );

        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

export const getStatistics = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const stats = await adminService.getGymStatistics();

        res.status(200).json(stats);
    } catch (error) {
        next(error);
    }
};
