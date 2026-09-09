import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatisticsService, StatisticsResponse } from './statistics.service';

@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './statistics.html',
  styleUrls: ['./statistics.css']
})
export class StatisticsComponent implements OnInit {
  data!: StatisticsResponse;
  isLoading = true;
  usingMockData = false;

  ranges: string[] = ['4 Weeks', '3 Months', '6 Months', 'Year-to-Date', 'All-Time'];
  selectedRange = '3 Months';

  constructor(private statsService: StatisticsService) {}

  ngOnInit(): void {
    this.fetchData(this.selectedRange);
  }

  fetchData(range: string): void {
    this.selectedRange = range;
    this.isLoading = true;

    this.statsService.getStatisticsData(range).subscribe({
      next: (res: StatisticsResponse) => {
        this.data = res;
        this.isLoading = false;
      },
      error: (err: unknown) => {
        console.error('حدث خطأ أثناء جلب البيانات:', err);
        this.data = this.statsService.createMockData();
        this.usingMockData = true;
        this.isLoading = false;
      }
    });
  }

  trackByIndex(index: number): number {
    return index;
  }

  downloadPdf(): void {
    window.print();
  }
}

