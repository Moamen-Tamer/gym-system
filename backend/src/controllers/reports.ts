import type { Request, Response, NextFunction } from "express";
import * as reportService from "../services/reports.js";

const noCache = (res: Response) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
};

export const getReport = async (
    req: Request<{ memberId: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const report = await reportService.getMemberReport(req.params.memberId);

        noCache(res);
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

        noCache(res);
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

        noCache(res);
        res.status(200).type("html").send(html);
    } catch (error) {
        next(error);
    }
};
