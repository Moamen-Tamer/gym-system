import z from "zod";
import { uuid } from "./common.js";

export const reportSchema = z.object({
    body: z.unknown(),
    query: z.unknown(),
    params: z.object({
        memberId: uuid("member")
    })
});

export const qrReportSchema = z.object({
    body: z.unknown(),
    query: z.unknown(),
    params: z.object({
        memberId: uuid("member")
    })
});