import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, filter, take, switchMap } from 'rxjs/operators';

/**
 * Auth Guard to protect routes that require authentication
 * Usage: Add to route configuration with canActivate: [authGuard]
 *
 * IMPORTANT: This guard waits for Firebase Auth to finish loading
 * before checking authentication state to prevent premature redirects
 * on browser refresh.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for auth to finish loading before checking authentication
  return authService.loading$.pipe(
    filter(loading => !loading), // Wait until loading is false
    take(1),
    switchMap(() => authService.isAuthenticated$),
    take(1),
    map(isAuthenticated => {
      if (isAuthenticated) {
        return true;
      } else {
        // Redirect to sign in page with return URL
        router.navigate(['/signin'], {
          queryParams: { returnUrl: state.url }
        });
        return false;
      }
    })
  );
};
