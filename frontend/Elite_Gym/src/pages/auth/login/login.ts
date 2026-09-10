import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { switchMap, catchError, of } from 'rxjs';
import { AuthService } from '../../../app/services/auth.service';

const REMEMBER_EMAIL_KEY = 'elite_remembered_email';

@Component({
  selector: 'app-login',
  imports: [RouterLink, ReactiveFormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  showPassword = false;
  isLoading = false;
  errorMessage = '';

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    rememberMe: [false],
  });

  ngOnInit(): void {
    // Pre-fill email if user previously checked "Remember me"
    const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);
    if (savedEmail) {
      this.loginForm.patchValue({ email: savedEmail, rememberMe: true });
    }
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    console.log('[Login] Starting login request...');

    const { email, password, rememberMe } = this.loginForm.value;

    // Persist or clear the remembered email
    if (rememberMe) {
      localStorage.setItem(REMEMBER_EMAIL_KEY, email!);
    } else {
      localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }

    this.authService.login({ email: email!, password: password! }).pipe(
      switchMap(() => this.authService.adminLogin().pipe(
        catchError(() => of(null)) // admin login failure is non-blocking
      ))
    ).subscribe({
      next: () => {
        console.log('[Login] Success!');
        this.isLoading = false;
        this.cdr.detectChanges();
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        console.error('[Login] Error caught in component:', err);
        this.isLoading = false;
        this.errorMessage =
          err?.error?.message || 'Invalid email or password. Please try again.';
        this.cdr.detectChanges();
      },
    });
  }

  get emailControl()    { return this.loginForm.get('email'); }
  get passwordControl() { return this.loginForm.get('password'); }
  get rememberMeControl() { return this.loginForm.get('rememberMe'); }
}

