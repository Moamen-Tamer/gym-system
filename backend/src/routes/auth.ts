import express, { type Router } from "express";
import { login, logout, refresh, register } from "../controllers/auth.js";
import { authenticateToken } from "../middlewares/authentication.js";
import { authLimiter } from "../middlewares/limiter.js";
import { validate } from "../middlewares/validate.js";
import { loginSchema, registerSchema } from "../schemas/auth.schema.js";

const auth: Router = express.Router();

auth.post('/register', authLimiter, validate(registerSchema), register);
auth.post('/login', authLimiter, validate(loginSchema), login);
auth.post('/logout', authenticateToken, logout);
auth.post('/refresh', refresh);

export default auth;
