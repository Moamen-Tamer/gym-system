import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

let isRefreshing = false;

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Always send cookies with every request
  const reqWithCreds = req.clone({ withCredentials: true });

  return next(reqWithCreds).pipe(
    catchError((error: HttpErrorResponse) => {
      // If 401 and not already refreshing and not the refresh endpoint itself
      if (
        error.status === 401 &&
        !isRefreshing &&
        !req.url.includes('/refresh') &&
        !req.url.includes('/login') &&
        !req.url.includes('/register')
      ) {
        isRefreshing = true;

        return authService.refreshToken().pipe(
          switchMap(() => {
            isRefreshing = false;
            // Retry the original request after refresh
            return next(reqWithCreds);
          }),
          catchError((refreshError) => {
            isRefreshing = false;
            // Refresh failed — redirect to login
            router.navigate(['/auth/login']);
            return throwError(() => refreshError);
          })
        );
      }

      return throwError(() => error);
    })
  );
};
