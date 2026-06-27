import { AbstractControl, ValidationErrors, ValidatorFn, AsyncValidatorFn } from '@angular/forms';
import { Observable, of, timer } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';

// Password validation result interface
export interface PasswordValidation {
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
}

/**
 * Validates email format
 */
export function validateEmail(email: string): boolean {
  if (!email) return false;

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

/**
 * Async Angular validator that checks disposable emails via Debounce API.
 * Debounces 500ms to avoid excessive API calls while typing.
 * On API failure, allows the email through (fails open).
 */
export function disposableEmailValidator(): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const email = control.value;
    if (!email || !email.includes('@')) return of(null);

    return timer(500).pipe(
      switchMap(() =>
        new Observable<ValidationErrors | null>(observer => {
          fetch(`https://disposable.debounce.io/?email=${encodeURIComponent(email.trim())}`)
            .then(res => res.json())
            .then(data => {
              observer.next(data?.disposable === 'true' ? { disposableEmail: true } : null);
              observer.complete();
            })
            .catch(() => {
              observer.next(null);
              observer.complete();
            });
        })
      ),
      catchError(() => of(null))
    );
  };
}

/**
 * Validates password strength
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];

  if (!password) {
    return { valid: false, errors: ['Password is required'], strength: 'weak' };
  }

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Calculate strength
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  if (errors.length === 0) {
    if (password.length >= 12 && /[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      strength = 'strong';
    } else if (password.length >= 8) {
      strength = 'medium';
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    strength
  };
}

/**
 * Custom Angular validator for password strength
 */
export function passwordStrengthValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const password = control.value;
    if (!password) {
      return null; // Don't validate empty value (use required validator for that)
    }

    const validation = validatePassword(password);
    return validation.valid ? null : { passwordStrength: validation.errors };
  };
}

/**
 * Custom Angular validator to match passwords
 */
export function passwordMatchValidator(passwordField: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.parent) {
      return null;
    }

    const password = control.parent.get(passwordField)?.value;
    const confirmPassword = control.value;

    if (!confirmPassword) {
      return null; // Don't validate empty value
    }

    return password === confirmPassword ? null : { passwordMismatch: true };
  };
}

/**
 * Get user-friendly error message from Firebase error code
 */
export function getFirebaseErrorMessage(errorCode: string): string {
  const errorMessages: { [key: string]: string } = {
    'auth/email-already-in-use': 'This email is already registered. Please sign in instead.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/operation-not-allowed': 'Email/password accounts are not enabled. Please contact support.',
    'auth/weak-password': 'Password should be at least 8 characters long with uppercase, lowercase, and numbers.',
    'auth/user-disabled': 'This account has been disabled. Please contact support.',
    'auth/user-not-found': 'No account found with this email. Please sign up first.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Invalid email or password. Please check your credentials.',
    'auth/invalid-login-credentials': 'Invalid email or password. Please check your credentials.',
    'auth/network-request-failed': 'Network error. Please check your internet connection and try again.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
    'auth/popup-closed-by-user': 'Sign-in popup was closed. Please try again.',
    'auth/cancelled-popup-request': 'Sign-in was cancelled. Please try again.',
    'auth/missing-password': 'Please enter your password.',
    'auth/missing-email': 'Please enter your email address.',
  };

  // Log unknown error codes for debugging
  if (!errorMessages[errorCode]) {
    console.warn('Unknown Firebase error code:', errorCode);
  }

  return errorMessages[errorCode] || `Authentication failed. Please check your credentials and try again.`;
}
