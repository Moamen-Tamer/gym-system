import express, { type Router } from "express";
import { getReport, getQrCode, getPrintableReport } from "../controllers/reports.js";
import { validate } from "../middlewares/validate.js";
import { reportSchema, qrReportSchema } from "../schemas/report.schema.js";

const reports: Router = express.Router();

reports.get('/:memberId', validate(reportSchema), getReport);
reports.get('/:memberId/qr', validate(qrReportSchema), getQrCode);
reports.get('/:memberId/print', validate(reportSchema), getPrintableReport);

export default reports;
