import express, { type Router } from "express";
import { getDashboard } from "../controllers/dashboard.js";

const dashboard: Router = express.Router();

dashboard.get('/', getDashboard);

export default dashboard;
