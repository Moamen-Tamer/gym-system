import { pinoHttp } from "pino-http";
import { logger as baseLogger } from "../config/logger.js";
import type { Request, Response } from "express";

const statusMeaning: Record<number, string> = {
    200: "OK",
    201: "Created",
    202: "Accepted",
    204: "No Content",
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    409: "Conflict",
    413: "Payload Too Large",
    415: "Unsupported Media Type",
    422: "Unprocessable Content",
    429: "Too Many Requests",
    500: "Internal Server Error"
};

export const describe = (
    method: string | undefined, 
    url: string | undefined, 
    status: number
) => {
    const meaning = statusMeaning[status] ?? "unknown";

    return `${method ?? "?"} ${url ?? "?"} ${status} ${meaning}`
};

export const logger = pinoHttp({
    logger: baseLogger,

    customLogLevel: (req: Request, res: Response, error: Error | undefined) => {
        if (error || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";

        return "info"
    },

    customSuccessMessage: (req: Request, res: Response) => describe(req.method, req.url, res.statusCode),

    customErrorMessage: (req: Request, res: Response, error: Error) => `${describe(req.method, req.url, res.statusCode)} - ${error.message}`
});
