import express, { type Router } from "express";
import { login, listMembers, createMember, updateMember, deleteMember, changeSubscription, getMemberWorkouts, getStatistics } from "../controllers/admin.js";
import { authenticateAdmin } from "../middlewares/authentication.js";
import { authorizeAdmin } from "../middlewares/authorization.js";
import { authLimiter } from "../middlewares/limiter.js";
import { validate } from "../middlewares/validate.js";
import { adminLoginSchema } from "../schemas/auth.schema.js";
import { createMemberSchema, memberIdSchema, updateMemberSchema, changeSubscriptionSchema } from "../schemas/member.schema.js";
import { adminWorkoutHistorySchema } from "../schemas/workout.schema.js";

const admin: Router = express.Router();

admin.post('/login', authLimiter, validate(adminLoginSchema), login);
admin.get('/members', authenticateAdmin, authorizeAdmin, listMembers);
admin.post('/members', authenticateAdmin, authorizeAdmin, validate(createMemberSchema), createMember);
admin.put('/members/:id', authenticateAdmin, authorizeAdmin, validate(updateMemberSchema), updateMember);
admin.delete('/members/:id', authenticateAdmin, authorizeAdmin, validate(memberIdSchema), deleteMember);
admin.patch('/members/:id/subscription', authenticateAdmin, authorizeAdmin, validate(changeSubscriptionSchema), changeSubscription);
admin.get('/members/:memberId/workouts', authenticateAdmin, authorizeAdmin, validate(adminWorkoutHistorySchema), getMemberWorkouts);
admin.get('/statistics', authenticateAdmin, authorizeAdmin, getStatistics);

export default admin;