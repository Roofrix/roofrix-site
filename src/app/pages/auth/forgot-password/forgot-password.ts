import { Component, inject, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
})
export class ForgotPassword implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  forgotForm!: FormGroup;
  loading = false;
  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  onSubmit(): void {
    if (this.forgotForm.invalid) {
      this.forgotForm.get('email')?.markAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const { email } = this.forgotForm.value;

    this.authService.forgotPassword(email).subscribe({
      next: (result) => {
        this.ngZone.run(() => {
          this.loading = false;
          if (result.success) {
            this.successMessage = 'Password reset link sent! Please check your inbox.';
          } else {
            this.errorMessage = result.error || 'Failed to send reset email. Please try again.';
          }
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.loading = false;
          this.errorMessage = 'An unexpected error occurred. Please try again.';
          this.cdr.detectChanges();
        });
      }
    });
  }

  hasError(fieldName: string, errorType: string): boolean {
    const field = this.forgotForm.get(fieldName);
    return !!(field && field.hasError(errorType) && field.touched);
  }

  getErrorMessage(fieldName: string): string {
    const field = this.forgotForm.get(fieldName);
    if (!field || !field.touched) return '';

    if (field.hasError('required')) return 'Email is required';
    if (field.hasError('email')) return 'Please enter a valid email address';
    return '';
  }
}
