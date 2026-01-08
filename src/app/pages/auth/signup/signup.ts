import { Component, inject, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { passwordStrengthValidator, passwordMatchValidator, validatePassword, PasswordValidation } from '../../../core/utils/validators';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './signup.html',
  styleUrl: './signup.scss',
})
export class SignUp implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  signUpForm!: FormGroup;
  loading = false;
  errorMessage = '';
  showPassword = false;
  showConfirmPassword = false;
  passwordValidation: PasswordValidation | null = null;

  ngOnInit(): void {
    // Initialize form
    this.signUpForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8), passwordStrengthValidator()]],
      confirmPassword: ['', [Validators.required, passwordMatchValidator('password')]],
      acceptTerms: [false, [Validators.requiredTrue]]
    });

    // Watch password field for strength indicator
    this.signUpForm.get('password')?.valueChanges.subscribe(password => {
      if (password) {
        this.passwordValidation = validatePassword(password);
      } else {
        this.passwordValidation = null;
      }
    });
  }

  /**
   * Toggle password visibility
   */
  togglePasswordVisibility(field: 'password' | 'confirmPassword'): void {
    if (field === 'password') {
      this.showPassword = !this.showPassword;
    } else {
      this.showConfirmPassword = !this.showConfirmPassword;
    }
  }

  /**
   * Get password strength class for styling
   */
  getPasswordStrengthClass(): string {
    if (!this.passwordValidation) return '';
    return `strength-${this.passwordValidation.strength}`;
  }

  /**
   * Get password strength text
   */
  getPasswordStrengthText(): string {
    if (!this.passwordValidation) return '';
    const strength = this.passwordValidation.strength;
    return strength.charAt(0).toUpperCase() + strength.slice(1);
  }

  /**
   * Handle form submission
   */
  onSubmit(): void {
    if (this.signUpForm.invalid) {
      this.markFormGroupTouched(this.signUpForm);
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const { email, password } = this.signUpForm.value;

    this.authService.signUp(email, password).subscribe({
      next: (result) => {
        if (result.success) {
          // Navigate to customer dashboard after successful signup
          this.router.navigate(['/dashboard/customer/new-order']);
        } else {
          this.ngZone.run(() => {
            this.errorMessage = result.error || 'Sign up failed. Please try again.';
            this.loading = false;
            console.log('Error message set:', this.errorMessage);
          });
        }
      },
      error: () => {
        this.ngZone.run(() => {
          this.errorMessage = 'An unexpected error occurred. Please try again.';
          this.loading = false;
          console.log('Error occurred, message set:', this.errorMessage);
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
    const field = this.signUpForm.get(fieldName);
    return !!(field && field.hasError(errorType) && field.touched);
  }

  /**
   * Get error message for a field
   */
  getErrorMessage(fieldName: string): string {
    const field = this.signUpForm.get(fieldName);

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
      if (field.hasError('passwordStrength') && this.passwordValidation) {
        return this.passwordValidation.errors[0];
      }
    }

    if (fieldName === 'confirmPassword') {
      if (field.hasError('required')) {
        return 'Please confirm your password';
      }
      if (field.hasError('passwordMismatch')) {
        return 'Passwords do not match';
      }
    }

    if (fieldName === 'acceptTerms') {
      if (field.hasError('required')) {
        return 'You must accept the terms and conditions';
      }
    }

    return '';
  }
}
