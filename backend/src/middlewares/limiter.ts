import rateLimit from "express-rate-limit";
import type { RateLimitRequestHandler } from "express-rate-limit";

export const limiter: RateLimitRequestHandler = rateLimit({
    windowMs: 1000 * 60 * 60,
    max: 1000,
    message: "too many requests, please try again later"
});

export const authLimiter: RateLimitRequestHandler = rateLimit({
    windowMs: 1000 * 60 * 5,
    max: 1000,
    message: "too many authentication requests, please try again later"
});
