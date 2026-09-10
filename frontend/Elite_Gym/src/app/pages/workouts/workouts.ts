import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Workout,
  WorkoutService,
  WorkoutType
} from './workouts.service';

@Component({
  selector: 'app-workouts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './workouts.html',
  styleUrl: './workouts.css'
})
export class Workouts implements OnInit, OnDestroy {
  readonly workoutTypes: { value: WorkoutType; label: string; icon: string }[] = [
    { value: 'strength', label: 'Strength', icon: '🏋' },
    { value: 'hiit', label: 'HIIT', icon: '⚡' },
    { value: 'cardio', label: 'Cardio', icon: '♥' },
    { value: 'flexibility', label: 'Flexibility', icon: '🧘' },
    { value: 'crossfit', label: 'CrossFit', icon: '✦' },
    { value: 'yoga', label: 'Yoga', icon: '☯' },
    { value: 'other', label: 'Other', icon: '●' }
  ];

  selectedType: WorkoutType = 'strength';
  activeWorkout: Workout | null = null;
  elapsedSeconds = 0;
  calories = 0;
  feedback = '';
  loading = false;
  error = '';
  success = '';
  private timerId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly workoutService: WorkoutService,
    private readonly cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.workoutService.getActiveWorkout().then(
      response => {
        if (response.workout && !response.workout.endTimestamp) {
          this.activeWorkout = response.workout;
          this.selectedType = response.workout.workoutType;
          this.startTimer();
          this.cdr.markForCheck();
        }
      },
      () => {}
    );
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  get isActive(): boolean {
    return !!this.activeWorkout && !this.activeWorkout.endTimestamp;
  }

  get timerText(): string {
    const hours = Math.floor(this.elapsedSeconds / 3600);
    const minutes = Math.floor((this.elapsedSeconds % 3600) / 60);
    const seconds = this.elapsedSeconds % 60;

    return [hours, minutes, seconds]
      .map((value) => String(value).padStart(2, '0'))
      .join(':');
  }

  selectType(type: WorkoutType): void {
    if (!this.isActive) {
      this.selectedType = type;
      this.cdr.markForCheck();
    }
  }

  startWorkout(): void {
    this.loading = true;
    this.error = '';
    this.success = '';
    this.cdr.markForCheck();

    this.workoutService.startWorkout(this.selectedType).then(
      response => {
        this.activeWorkout = response.workout;
        this.elapsedSeconds = 0;
        this.calories = 0;
        this.feedback = '';
        this.startTimer();
        this.success = 'Workout started successfully.';
        this.loading = false;
        this.cdr.markForCheck();
      },
      error => {
        this.error = error.message;
        this.loading = false;
        this.cdr.markForCheck();
      }
    );
  }

  stopWorkout(): void {
    if (!this.activeWorkout) return;

    this.loading = true;
    this.error = '';
    this.success = '';
    this.cdr.markForCheck();

    const id = this.activeWorkout._id ?? this.activeWorkout.id;
    if (!id) {
      this.error = 'Workout ID is missing.';
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    this.workoutService.stopWorkout(id, this.calories > 0 ? this.calories : undefined).then(
      response => {
        this.activeWorkout = response.workout;
        this.elapsedSeconds = response.workout.duration ?? this.elapsedSeconds;
        this.clearTimer();
        this.success = 'Workout stopped successfully.';

        if (this.feedback.trim()) {
          this.sendFeedback(id);
        } else {
          this.loading = false;
          this.cdr.markForCheck();
        }
      },
      error => {
        this.error = error.message;
        this.loading = false;
        this.cdr.markForCheck();
      }
    );
  }

  saveFeedback(): void {
    if (!this.activeWorkout || !this.feedback.trim()) return;

    const id = this.activeWorkout._id ?? this.activeWorkout.id;
    if (!id) return;

    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();

    this.sendFeedback(id);
  }

  resetSession(): void {
    this.activeWorkout = null;
    this.elapsedSeconds = 0;
    this.calories = 0;
    this.feedback = '';
    this.error = '';
    this.success = '';
    this.clearTimer();
    this.cdr.markForCheck();
  }

  private sendFeedback(id: string): void {
    this.workoutService.submitFeedback(id, this.feedback.trim()).then(
      response => {
        if (this.activeWorkout) {
          this.activeWorkout = {
            ...this.activeWorkout,
            feedback: response.workout.feedback
          };
        }
        this.success = 'Feedback saved.';
        this.loading = false;
        this.cdr.markForCheck();
      },
      error => {
        this.error = error.message;
        this.loading = false;
        this.cdr.markForCheck();
      }
    );
  }

  private startTimer(): void {
    this.clearTimer();

    this.timerId = setInterval(() => {
      if (!this.activeWorkout) return;

      const start = new Date(this.activeWorkout.startTimestamp).getTime();
      this.elapsedSeconds = Math.max(
        0,
        Math.floor((Date.now() - start) / 1000)
      );
      this.cdr.markForCheck();
    }, 1000);
  }

  private clearTimer(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}

export { Workouts as WorkoutsComponent };

