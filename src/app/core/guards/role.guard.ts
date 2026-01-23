import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { map, take, switchMap, filter } from 'rxjs/operators';
import { of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';

/**
 * Role-based route guard
 * Checks if user has required role to access route
 *
 * IMPORTANT: This guard waits for Firebase Auth to finish loading
 * before checking user role to prevent premature redirects on browser refresh.
 */
export function roleGuard(allowedRoles: string[]): CanActivateFn {
  return (route, state) => {
    const authService = inject(AuthService);
    const userService = inject(UserService);
    const router = inject(Router);

    // Wait for auth to finish loading before checking user
    return authService.loading$.pipe(
      filter(loading => !loading), // Wait until loading is false
      take(1),
      switchMap(() => authService.currentUser$),
      take(1),
      switchMap(user => {
        if (!user) {
          // Not authenticated, redirect to signin
          router.navigate(['/signin'], { queryParams: { returnUrl: state.url } });
          return of(false);
        }

        // Get user profile to check role
        return userService.userProfileListener(user.uid).pipe(
          take(1),
          map(profile => {
            if (!profile) {
              console.error('User profile not found');
              router.navigate(['/']);
              return false;
            }

            // Check if user has allowed role
            if (allowedRoles.includes(profile.role)) {
              return true;
            }

            // User doesn't have required role, redirect based on their role
            console.warn(`User role '${profile.role}' not authorized for route: ${state.url}`);

            if (profile.role === 'admin') {
              router.navigate(['/dashboard/admin/orders']);
            } else if (profile.role === 'designer') {
              router.navigate(['/dashboard/designer/orders']);
            } else if (profile.role === 'customer') {
              router.navigate(['/dashboard/customer/orders']);
            } else {
              router.navigate(['/']);
            }

            return false;
          })
        );
      })
    );
  };
}

/**
 * Admin-only guard
 */
export const adminGuard: CanActivateFn = roleGuard(['admin']);

/**
 * Customer-only guard
 */
export const customerGuard: CanActivateFn = roleGuard(['customer']);

/**
 * Designer-only guard
 */
export const designerGuard: CanActivateFn = roleGuard(['designer']);

/**
 * Customer or Admin guard
 */
export const customerOrAdminGuard: CanActivateFn = roleGuard(['customer', 'admin']);

/**
 * Any authenticated user with a valid role
 */
export const dashboardGuard: CanActivateFn = roleGuard(['admin', 'customer', 'designer']);
