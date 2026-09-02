import mongoose, { Model, Document, Schema } from "mongoose";

export interface IWorkout extends Document {
    memberId: string;
    startTimestamp: Date;
    endTimestamp: Date | null;
    duration: number | null;
    workoutType: string;
    calories: number | null;
    feedback?: string | null;
    createdAt: Date;
};

const WorkoutSchema = new Schema<IWorkout> (
    {
        memberId: {
            type: String,
            required: true,
            index: true
        },
        startTimestamp: {
            type: Date,
            required: true
        },
        endTimestamp: {
            type: Date,
            default: null
        },
        duration: {
            type: Number,
            default: null
        },
        workoutType: {
            type: String,
            required: true,
            trim: true,
            enum: ["strength", "cardio", "flexibility", "hiit", "crossfit", "yoga", "other"]
        },
        calories: {
            type: Number,
            default: null,
            min: 0
        },
        feedback: {
            type: String,
            trim: true,
            maxLength: 1000,
            default: null
        }
    },
    { 
        timestamps: {
            createdAt: 'createdAt',
            updatedAt: false
        },
        collection: "workouts"
    }
);

WorkoutSchema.index({ memberId: 1, createdAt: -1 });

const Workout: Model<IWorkout> = mongoose.model("Workout", WorkoutSchema);

export default Workout;