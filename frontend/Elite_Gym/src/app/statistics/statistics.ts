import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatisticsService, StatisticsResponse } from './statistics.service';

interface KpiCard {
  title: string;
  value: string;
  detail: string;
  icon: string;
  accent: 'lime' | 'white';
}

@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './statistics.html',
  styleUrls: ['./statistics.css'],
})
export class StatisticsComponent implements OnInit {
  isLoading = true;
  hasError = false;
  usingMockData = false;
  lastUpdated: Date | null = null;

  cards: KpiCard[] = [];

  constructor(private statsService: StatisticsService) {}

  ngOnInit(): void {
    this.fetchData();
  }

  fetchData(): void {
    this.isLoading = true;
    this.hasError = false;
    this.usingMockData = false;

    this.statsService.getStatistics().subscribe({
      next: (res: StatisticsResponse) => {
        this.cards = this.mapToCards(res);
        this.lastUpdated = new Date();
        this.isLoading = false;
      },
      error: (err: unknown) => {
        console.error('حدث خطأ أثناء جلب البيانات:', err);
        this.cards = this.mapToCards(this.statsService.createMockData());
        this.usingMockData = true;
        this.isLoading = false;
      },
    });
  }

  trackByIndex(index: number): number {
    return index;
  }

  private mapToCards(data: StatisticsResponse): KpiCard[] {
    const activeRate =
      data.totalMembers > 0
        ? Math.round((data.activeSubscriptions / data.totalMembers) * 100)
        : 0;

    return [
      {
        title: 'TOTAL MEMBERS',
        value: this.formatNumber(data.totalMembers),
        detail: 'Registered gym members',
        icon: 'assets/icons/Background.svg',
        accent: 'lime',
      },
      {
        title: 'ACTIVE SUBSCRIPTIONS',
        value: this.formatNumber(data.activeSubscriptions),
        detail: `${activeRate}% of total members`,
        icon: 'assets/icons/True-sign.svg',
        accent: 'white',
      },
      {
        title: 'TOTAL WORKOUTS',
        value: this.formatNumber(data.totalWorkouts),
        detail: 'Logged gym-wide',
        icon: 'assets/icons/Peak.svg',
        accent: 'white',
      },
      {
        title: 'TOTAL CALORIES',
        value: this.formatNumber(data.totalCalories),
        detail: 'Burned across all workouts',
        icon: 'assets/icons/Heart-rate.svg',
        accent: 'white',
      },
      {
        title: 'AVERAGE DURATION',
        value: this.formatDuration(data.averageDuration),
        detail: 'Per workout session',
        icon: 'assets/icons/calender.svg',
        accent: 'white',
      },
      {
        title: 'MOST POPULAR TYPE',
        value: this.capitalize(data.mostPopularWorkoutType),
        detail: 'Top workout category',
        icon: 'assets/icons/chart.svg',
        accent: 'lime',
      },
    ];
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value ?? 0);
  }

  private formatDuration(minutes: number): string {
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  }

  private capitalize(value: string): string {
    if (!value) return '—';
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
