import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Workout,
  WorkoutService,
  WorkoutType
} from '../workouts/workouts.service';

@Component({
  selector: 'app-workout-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './history.html',
  styleUrl: './history.css'
})
export class History implements OnInit {
  readonly workoutTypes: { value: WorkoutType | ''; label: string }[] = [
    { value: '', label: 'All Workouts' },
    { value: 'strength', label: 'Strength' },
    { value: 'hiit', label: 'HIIT' },
    { value: 'cardio', label: 'Cardio' },
    { value: 'flexibility', label: 'Flexibility' },
    { value: 'crossfit', label: 'CrossFit' },
    { value: 'yoga', label: 'Yoga' },
    { value: 'other', label: 'Other' }
  ];

  workouts: Workout[] = [];
  selectedType: WorkoutType | '' = '';
  selectedWorkout: Workout | null = null;
  page = 1;
  readonly limit = 10;
  total = 0;
  loading = false;
  error = '';

  constructor(
    private readonly workoutService: WorkoutService,
    private readonly cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadHistory();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.limit));
  }

  get hasPrevious(): boolean {
    return this.page > 1;
  }

  get hasNext(): boolean {
    return this.page < this.totalPages;
  }

  loadHistory(): void {
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();

    const type = this.selectedType || undefined;

    this.workoutService.getHistory(this.page, this.limit, type).then(
      response => {
        this.workouts = response.workouts ?? [];
        this.total = response.total ?? 0;
        this.page = response.page ?? this.page;
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

  changeFilter(): void {
    this.page = 1;
    this.loadHistory();
  }

  previousPage(): void {
    if (!this.hasPrevious) return;
    this.page--;
    this.loadHistory();
  }

  nextPage(): void {
    if (!this.hasNext) return;
    this.page++;
    this.loadHistory();
  }

  openDetails(workout: Workout): void {
    this.selectedWorkout = workout;
    this.cdr.markForCheck();
  }

  closeDetails(): void {
    this.selectedWorkout = null;
    this.cdr.markForCheck();
  }

  formatDuration(seconds: number | null): string {
    if (seconds === null || seconds === undefined) return '--';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes}m ${secs}s`;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '--';

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  }

  typeLabel(type: string): string {
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  workoutId(workout: Workout): string {
    return workout._id ?? workout.id ?? '--';
  }
}

export { History as HistoryComponent };