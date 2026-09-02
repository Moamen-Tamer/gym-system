import express, { type Router } from "express";
import { getAccount, getSubscription, getWorkoutDays } from "../controllers/members.js";

const members: Router = express.Router();

members.get('/me', getAccount);
members.get('/me/subscription', getSubscription);
members.get('/me/workout-days', getWorkoutDays);

export default members;
