import type { ErrorRequestHandler } from "express";
import { HttpError } from "../errors/HttpError.js";

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
    if (res.headersSent) return next(error);

    if (error instanceof HttpError) {
        res.status(error.status).json({ message: error.message });

        return;
    }

    if (error instanceof SyntaxError && "body" in error) {
        res.status(400).json({ message: "Invalid JSON request body." });

        return;
    }

    if (error?.name === "CastError") {
        res.status(400).json({ message: "Invalid resource identifier." });

        return;
    }

    console.error(error);

    res.status(500).json({ message: "Internal server error." });
};
