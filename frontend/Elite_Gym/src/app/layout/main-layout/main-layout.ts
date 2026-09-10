import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout {
  private authService = inject(AuthService);
  private router = inject(Router);

  isLoggingOut = false;

  navItems: NavItem[] = [
    { label: 'Dashboard',  icon: 'dashboard',   route: '/dashboard'   },
    { label: 'Members',    icon: 'members',      route: '/members'     },
    { label: 'Workouts',   icon: 'workouts',     route: '/workouts'    },
    { label: 'History',    icon: 'history',      route: '/history'     },
    { label: 'Statistics', icon: 'statistics',   route: '/statistics'  },
    { label: 'Reports',    icon: 'reports',      route: '/reports'     },
  ];

  logout(): void {
    this.isLoggingOut = true;
    this.authService.logout().subscribe({
      next: () => {
        this.isLoggingOut = false;
        this.router.navigate(['/auth/login']);
      },
      error: () => {
        // Even if server call fails, clear local state and redirect
        this.isLoggingOut = false;
        this.router.navigate(['/auth/login']);
      },
    });
  }
}
