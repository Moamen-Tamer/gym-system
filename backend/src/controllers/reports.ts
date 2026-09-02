import type { Request, Response, NextFunction } from "express";
import * as reportService from "../services/reports.js";

export const getReport = async (
    req: Request<{ memberId: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const report = await reportService.getMemberReport(req.params.memberId);

        res.status(200).json({ report });
    } catch (error) {
        next(error);
    }
};

export const getQrCode = async (
    req: Request<{ memberId: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const qrCode = await reportService.getReportQrCode(req.params.memberId);

        res.status(200).json({ qrCode });
    } catch (error) {
        next(error);
    }
};

export const getPrintableReport = async (
    req: Request<{ memberId: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const html = await reportService.getPrintableReportHtml(req.params.memberId);

        res.status(200).type("html").send(html);
    } catch (error) {
        next(error);
    }
};
