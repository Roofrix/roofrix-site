import { Component, inject, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { switchMap, take } from 'rxjs/operators';

@Component({
  selector: 'app-signin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './signin.html',
  styleUrl: './signin.scss',
})
export class SignIn implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  signInForm!: FormGroup;
  loading = false;
  errorMessage = '';
  showPassword = false;
  returnUrl = '';

  ngOnInit(): void {
    // Get return URL from route parameters
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '';

    // Initialize form
    this.signInForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    });
  }

  /**
   * Toggle password visibility
   */
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  /**
   * Handle form submission
   */
  onSubmit(): void {
    if (this.signInForm.invalid) {
      this.markFormGroupTouched(this.signInForm);
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const { email, password } = this.signInForm.value;

    this.authService.signIn(email, password).pipe(
      switchMap((result) => {
        console.log('Sign in result:', result);
        if (!result.success) {
          console.log('Sign in failed with error:', result.error);
          throw new Error(result.error || 'Sign in failed');
        }
        // Get current user to determine role-based redirect
        return this.authService.currentUser$.pipe(take(1));
      }),
      switchMap((user) => {
        if (!user) {
          throw new Error('User not found');
        }
        // Get user profile to check role
        return this.userService.userProfileListener(user.uid).pipe(take(1));
      })
    ).subscribe({
      next: (profile) => {
        this.ngZone.run(() => {
          if (!profile) {
            this.errorMessage = 'User profile not found';
            this.loading = false;
            this.cdr.detectChanges();
            return;
          }

          // Redirect based on return URL or user role
          if (this.returnUrl) {
            this.router.navigate([this.returnUrl]);
          } else {
            // Role-based default redirect
            if (profile.role === 'admin') {
              this.router.navigate(['/dashboard/admin/orders']);
            } else if (profile.role === 'designer') {
              this.router.navigate(['/dashboard/designer/orders']);
            } else {
              this.router.navigate(['/dashboard/customer/new-order']);
            }
          }
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          console.log('Sign in subscribe error:', err);
          this.errorMessage = err.message || 'An unexpected error occurred. Please try again.';
          this.loading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  /**
   * Mark all form fields as touched to show validation errors
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  /**
   * Check if a field has an error and has been touched
   */
  hasError(fieldName: string, errorType: string): boolean {
    const field = this.signInForm.get(fieldName);
    return !!(field && field.hasError(errorType) && field.touched);
  }

  /**
   * Get error message for a field
   */
  getErrorMessage(fieldName: string): string {
    const field = this.signInForm.get(fieldName);

    if (!field || !field.touched) {
      return '';
    }

    if (fieldName === 'email') {
      if (field.hasError('required')) {
        return 'Email is required';
      }
      if (field.hasError('email')) {
        return 'Please enter a valid email address';
      }
    }

    if (fieldName === 'password') {
      if (field.hasError('required')) {
        return 'Password is required';
      }
      if (field.hasError('minlength')) {
        return 'Password must be at least 8 characters';
      }
    }

    return '';
  }
}
