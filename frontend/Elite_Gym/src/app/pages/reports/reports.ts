import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ReportsService, MemberReport } from '../../services/reports.service';

interface MemberOption {
  id: string;
  full_name: string;
  email: string;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class Reports implements OnInit {
  members: MemberOption[] = [];
  selectedMemberId = '';

  report: MemberReport | null = null;
  qrCode: string | null = null;

  loadingMembers = true;
  loadingReport = false;
  errorMsg = '';

  constructor(
    private reportsService: ReportsService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadMembers();
  }

  loadMembers(): void {
    this.http
      .get<{ members: any[]; total: number }>('http://localhost:3000/api/admin/members?limit=500', {
        withCredentials: true,
      })
      .subscribe({
        next: (res) => {
          this.members = (res.members ?? []).map((m: any) => ({
            id: m.id,
            full_name: m.full_name,
            email: m.email,
          }));
          this.loadingMembers = false;
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        },
        error: () => {
          this.errorMsg = 'Failed to load member list.';
          this.loadingMembers = false;
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        },
      });
  }

  onMemberSelect(): void {
    if (!this.selectedMemberId) return;
    this.loadReport(this.selectedMemberId);
  }

  loadReport(memberId: string): void {
    this.loadingReport = true;
    this.report = null;
    this.qrCode = null;
    this.errorMsg = '';
    this.cdr.markForCheck();
    this.cdr.detectChanges();

    this.reportsService.getReport(memberId).subscribe({
      next: (res) => {
        this.report = res.report;
        this.loadingReport = false;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
        this.loadQr(memberId);
      },
      error: () => {
        this.errorMsg = 'Failed to load report for this member.';
        this.loadingReport = false;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      },
    });
  }

  loadQr(memberId: string): void {
    this.reportsService.getQrCode(memberId).subscribe({
      next: (res) => {
        this.qrCode = res.qrCode;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      },
      error: () => {}, // non-blocking
    });
  }

  openPrintableReport(): void {
    if (!this.selectedMemberId) return;
    window.open(this.reportsService.getPrintUrl(this.selectedMemberId), '_blank');
  }

  formatDuration(seconds: number): string {
    if (!seconds || seconds === 0) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString([], {
      month: 'short', day: '2-digit',
      year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  capitalize(str: string): string {
    if (!str || str === 'none') return '—';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  getBarWidth(values: number[], index: number): string {
    const max = Math.max(...values, 1);
    const pct = Math.round((values[index] / max) * 100);
    return `${Math.max(pct, values[index] > 0 ? 4 : 0)}%`;
  }
}