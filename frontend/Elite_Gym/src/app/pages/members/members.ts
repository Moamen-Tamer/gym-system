import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';

import { AdminStatistics, Member, MemberFilter } from './members-model';
import { MemberService } from './members.service';

@Component({
  selector: 'app-member-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './members.html',
  styleUrls: ['./members.css'],
})
export class MemberManagementComponent implements OnInit, OnDestroy {
  members: Member[] = [];
  stats: AdminStatistics | null = null;

  searchTerm = '';
  activeFilter: MemberFilter = 'all';
  filters: { key: MemberFilter; label: string }[] = [
    { key: 'all', label: 'All Members' },
    { key: 'elite', label: 'Elite Tier' },
    { key: 'pro', label: 'Pro Tier' },
    { key: 'expiring', label: 'Expiring Soon' },
  ];

  page = 1;
  limit = 10;
  total = 0;

  loading = false;
  errorMessage: string | null = null;

  memberPendingDelete: Member | null = null;

  showAddModal = false;
  addForm: { name: string; email: string; phone: string; subscriptionLevel: Member['subscriptionLevel'] } = {
    name: '',
    email: '',
    phone: '',
    subscriptionLevel: 'Basic',
  };
  addErrors: { name?: string; email?: string; phone?: string; general?: string } = {};
  addSubmitting = false;

  editingMember: Member | null = null;
  editForm: { name: string; phone: string } = { name: '', phone: '' };
  editErrors: { name?: string; phone?: string; general?: string } = {};
  editSubmitting = false;

  private search$ = new Subject<string>();
  private subs = new Subscription();

  constructor(private memberService: MemberService, private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    this.subs.add(
      this.search$.pipe(debounceTime(350), distinctUntilChanged()).subscribe(() => {
        this.page = 1;
        this.loadMembers();
      })
    );

    this.loadMembers();
    this.loadStatistics();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.search$.next(value);
  }

  setFilter(filter: MemberFilter): void {
    if (this.activeFilter === filter) return;
    this.activeFilter = filter;
    this.page = 1;
    this.loadMembers();
  }

  loadMembers(): void {
    this.loading = true;
    this.errorMessage = null;

    this.memberService
      .getMembers({
        page: this.page,
        limit: this.limit,
        search: this.searchTerm.trim() || undefined,
        filter: this.activeFilter,
      })
      .subscribe({
        next: (res) => {
          this.members = res.data;
          this.total = res.total;
          this.page = res.page;
          this.limit = res.limit;
          this.loading = false;
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        },
        error: () => {
          this.errorMessage = 'Could not load members. Please try again.';
          this.loading = false;
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        },
      });
  }

  loadStatistics(): void {
    this.memberService.getStatistics().subscribe({
      next: (res) => {
        this.stats = res;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      },
      error: () => {
        this.stats = null;
      },
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.limit));
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    const start = Math.max(1, this.page - 1);
    const end = Math.min(this.totalPages, start + 2);
    for (let p = start; p <= end; p++) pages.push(p);
    return pages;
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages || p === this.page) return;
    this.page = p;
    this.loadMembers();
  }

  prevPage(): void { this.goToPage(this.page - 1); }
  nextPage(): void { this.goToPage(this.page + 1); }

  statusLabel(member: Member): string {
    if (member.status === 'Expiring') {
      const days = member.expiresInDays ?? 0;
      return `Expiring (${days} day${days === 1 ? '' : 's'})`;
    }
    return member.status;
  }

  statusClass(member: Member): string {
    switch (member.status) {
      case 'Active': return 'status-active';
      case 'Expiring': return 'status-expiring';
      case 'Expired': return 'status-expired';
      default: return '';
    }
  }

  tierClass(member: Member): string {
    switch (member.subscriptionLevel) {
      case 'Elite': return 'tier-elite';
      case 'Pro': return 'tier-pro';
      default: return 'tier-basic';
    }
  }

  formatLastWorkout(iso?: string | null): string {
    if (!iso) return '—';
    const date = new Date(iso);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today, ${time}`;
    if (isYesterday) return `Yesterday, ${time}`;
    return date.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
  }

  confirmDelete(member: Member): void { this.memberPendingDelete = member; }
  cancelDelete(): void { this.memberPendingDelete = null; }

  deleteMember(): void {
    if (!this.memberPendingDelete) return;
    const id = this.memberPendingDelete.id;
    this.memberService.deleteMember(id).subscribe({
      next: () => {
        this.memberPendingDelete = null;
        this.loadMembers();
        this.loadStatistics();
      },
      error: () => {
        this.errorMessage = 'Could not delete this member. Please try again.';
        this.memberPendingDelete = null;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      },
    });
  }

  // ---- Add member ----

  openAddModal(): void {
    this.addForm = { name: '', email: '', phone: '', subscriptionLevel: 'Basic' };
    this.addErrors = {};
    this.showAddModal = true;
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  closeAddModal(): void {
    if (this.addSubmitting) return;
    this.showAddModal = false;
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  submitAddMember(): void {
    this.addErrors = {};

    const name = this.addForm.name.trim();
    const email = this.addForm.email.trim();
    const phone = this.addForm.phone.trim();

    if (!name) this.addErrors.name = 'Name is required.';
    if (!email) {
      this.addErrors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.addErrors.email = 'Enter a valid email address.';
    }
    if (!phone) {
      this.addErrors.phone = 'Phone is required.';
    } else if (!/^01\d{9}$/.test(phone.replace(/\s/g, ''))) {
      this.addErrors.phone = 'Enter a valid Egyptian phone number (e.g. 01012345678).';
    }
    if (this.addErrors.name || this.addErrors.email || this.addErrors.phone) return;

    this.addSubmitting = true;
    this.memberService
      .addMember({ name, email, phone: phone.replace(/\s/g, ''), subscriptionLevel: this.addForm.subscriptionLevel })
      .subscribe({
        next: () => {
          this.addSubmitting = false;
          this.showAddModal = false;
          this.page = 1;
          this.loadMembers();
          this.loadStatistics();
        },
        error: (err) => {
          this.addSubmitting = false;
          if (err?.status === 409) {
            this.addErrors.email = 'This email is already registered.';
          } else if (err?.status === 400) {
            this.addErrors.general = err?.error?.message || 'Please check all fields and try again.';
          } else {
            this.addErrors.general = 'Could not add this member. Please try again.';
          }
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        },
      });
  }

  // ---- Edit member ----

  openEditModal(member: Member): void {
    this.editingMember = member;
    this.editForm = { name: member.name, phone: member.phone ?? '' };
    this.editErrors = {};
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  closeEditModal(): void {
    if (this.editSubmitting) return;
    this.editingMember = null;
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  submitEditMember(): void {
    if (!this.editingMember) return;
    this.editErrors = {};

    const name = this.editForm.name.trim();
    const phone = this.editForm.phone.trim();
    if (!name) this.editErrors.name = 'Name is required.';
    if (!phone) {
      this.editErrors.phone = 'Phone is required.';
    } else if (!/^01\d{9}$/.test(phone.replace(/\s/g, ''))) {
      this.editErrors.phone = 'Enter a valid Egyptian phone number (e.g. 01012345678).';
    }
    if (this.editErrors.name || this.editErrors.phone) return;

    this.editSubmitting = true;
    this.memberService.updateMember(this.editingMember.id, { name, phone: phone.replace(/\s/g, '') }).subscribe({
      next: (updated) => {
        this.editSubmitting = false;
        const idx = this.members.findIndex((m) => m.id === updated.id);
        if (idx > -1) this.members[idx] = { ...this.members[idx], ...updated };
        this.editingMember = null;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.editSubmitting = false;
        if (err?.status === 400) {
          this.editErrors.general = err?.error?.message || 'Please check the phone format and try again.';
        } else {
          this.editErrors.general = 'Could not update this member. Please try again.';
        }
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      },
    });
  }

  changePlan(member: Member, level: Member['subscriptionLevel']): void {
    if (member.subscriptionLevel === level) return;
    this.memberService.changeSubscription(member.id, level).subscribe({
      next: (updated) => {
        member.subscriptionLevel = updated.subscriptionLevel;
        this.loadStatistics();
      },
      error: () => {
        this.errorMessage = 'Could not update the subscription tier.';
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      },
    });
  }
}

export { MemberManagementComponent as Members };