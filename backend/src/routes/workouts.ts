import express, { type Router } from "express";
import { startWorkout, stopWorkout, submitFeedback, getWorkoutHistory } from "../controllers/workouts.js";
import { validate } from "../middlewares/validate.js";
import { startWorkoutSchema, stopWorkoutSchema, feedbackSchema, memberWorkoutHistorySchema } from "../schemas/workout.schema.js";

const workouts: Router = express.Router();

workouts.post('/start', validate(startWorkoutSchema), startWorkout);
workouts.post('/:id/stop', validate(stopWorkoutSchema), stopWorkout);
workouts.patch('/:id/feedback', validate(feedbackSchema), submitFeedback);
workouts.get('/history', validate(memberWorkoutHistorySchema), getWorkoutHistory);

export default workouts;
