import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService, DashboardStats } from '../../services/dashboard.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  stats: DashboardStats | null = null;
  loading = true;
  errorMsg = '';

  constructor(
    private dashboardService: DashboardService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.dashboardService.getDashboard().subscribe({
      next: (data) => {
        this.stats = data;
        this.loading = false;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMsg = 'Failed to load dashboard data. Please try again.';
        this.loading = false;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
        console.error(err);
      },
    });
  }

  formatDuration(seconds: number): string {
    if (!seconds || seconds === 0) return '0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  capitalize(str: string): string {
    if (!str || str === 'none') return '—';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  getBarHeight(values: number[], index: number): string {
    const max = Math.max(...values, 1);
    const pct = Math.round((values[index] / max) * 100);
    return `${Math.max(pct, values[index] > 0 ? 6 : 2)}%`;
  }

  isActiveDay(label: string): boolean {
    return this.stats?.mostActiveDay === label;
  }
}