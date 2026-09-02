import { ObjectId } from 'mongodb';

export const up = async (db) => {
    await db.createCollection('workouts', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['memberId', 'startTimestamp', 'workoutType', 'createdAt'],
                properties: {
                    memberId: { bsonType: 'string' },
                    startTimestamp: { bsonType: 'date' },
                    endTimestamp: { bsonType: ['date', 'null'] },
                    duration: { bsonType: ['number', 'null'] },
                    workoutType: { bsonType: 'string', enum: ['strength', 'cardio', 'flexibility', 'hiit', 'crossfit', 'yoga', 'other'] },
                    calories: { bsonType: ['number', 'null'] },
                    feedback: { bsonType: ['string', 'null'] },
                    createdAt: { bsonType: 'date' }
                }
            }
        }
    });

    await db.collection('workouts').createIndex({ memberId: 1 });
    await db.collection('workouts').createIndex({ memberId: 1, createdAt: -1 });
};

export const down = async (db) => {
    await db.collection('workouts').drop();
};