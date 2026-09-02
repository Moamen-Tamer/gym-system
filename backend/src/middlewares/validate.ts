import type { NextFunction, ParamsDictionary, Request, RequestHandler, Response } from "express-serve-static-core";
import type z from "zod";
import { ZodError } from "zod";
import { HttpError } from "../errors/HttpError.js";

export const validate = (schema: z.ZodType): RequestHandler => {
    return async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try{
            const parsed = (await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params
            })) as { body?: unknown, query?: unknown, params?: unknown };
            
            req.body = parsed.body;
            req.params = (parsed.params ?? req.params) as ParamsDictionary;
            req.validated = parsed;

            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const message = error.issues[0]?.message ?? "Invalid request.";
                
                next(new HttpError(400, message));
                return;
            }

            next(error);
        }
    };
};
