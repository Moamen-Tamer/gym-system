import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { StatisticsService, StatisticsResponse } from './statistics.service';

export interface KpiCard {
  title: string;
  value: string;
  detail: string;
  iconSvg: SafeHtml;
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

  constructor(
    private statsService: StatisticsService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) { }

  ngOnInit(): void {
    this.fetchData();
  }

  fetchData(): void {
    this.isLoading = true;
    this.hasError = false;
    this.usingMockData = false;
    this.cdr.markForCheck();
    this.cdr.detectChanges();

    this.statsService.getStatistics().subscribe({
      next: (res: StatisticsResponse) => {
        this.cards = this.mapToCards(res);
        this.lastUpdated = new Date();
        this.isLoading = false;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      },
      error: (err: unknown) => {
        console.error('Error fetching statistics data:', err);
        this.cards = this.mapToCards(this.statsService.createMockData());
        this.usingMockData = true;
        this.isLoading = false;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
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
        iconSvg: this.sanitizeSvg(
          '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
        ),
        accent: 'lime',
      },
      {
        title: 'ACTIVE SUBSCRIPTIONS',
        value: this.formatNumber(data.activeSubscriptions),
        detail: `${activeRate}% of total members`,
        iconSvg: this.sanitizeSvg(
          '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
        ),
        accent: 'white',
      },
      {
        title: 'TOTAL WORKOUTS',
        value: this.formatNumber(data.totalWorkouts),
        detail: 'Logged gym-wide',
        iconSvg: this.sanitizeSvg(
          '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>'
        ),
        accent: 'white',
      },
      {
        title: 'TOTAL CALORIES',
        value: this.formatNumber(data.totalCalories),
        detail: 'Burned across all workouts',
        iconSvg: this.sanitizeSvg(
          '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3.5z"/></svg>'
        ),
        accent: 'white',
      },
      {
        title: 'AVERAGE DURATION',
        value: this.formatDuration(data.averageDuration),
        detail: 'Per workout session',
        iconSvg: this.sanitizeSvg(
          '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
        ),
        accent: 'white',
      },
      {
        title: 'MOST POPULAR TYPE',
        value: this.capitalize(data.mostPopularWorkoutType),
        detail: 'Top workout category',
        iconSvg: this.sanitizeSvg(
          '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>'
        ),
        accent: 'lime',
      },
    ];
  }

  private sanitizeSvg(svg: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value ?? 0);
  }

  private formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return '0m';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  }

  private capitalize(value: string): string {
    if (!value) return '—';
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}

export { StatisticsComponent as Statistics };