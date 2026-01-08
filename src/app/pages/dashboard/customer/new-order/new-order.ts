import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { OrderService } from '../../../../core/services/order.service';

@Component({
  selector: 'app-new-order',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './new-order.html',
  styleUrl: './new-order.scss',
})
export class NewOrder {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private orderService = inject(OrderService);
  private router = inject(Router);

  orderForm!: FormGroup;
  loading = false;
  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    this.orderForm = this.fb.group({
      projectName: ['', [Validators.required, Validators.minLength(3)]],
      projectAddress: ['', [Validators.required]],
      projectDescription: [''],
      roofType: [''],
      estimatedArea: [null, [Validators.min(0)]],
      priority: ['medium']
    });
  }

  async onSubmit(): Promise<void> {
    if (this.orderForm.invalid) {
      this.markFormGroupTouched(this.orderForm);
      return;
    }

    const user = this.authService.getCurrentUser();
    if (!user) {
      this.errorMessage = 'You must be logged in to create an order';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const formValue = this.orderForm.value;

      await this.orderService.createOrder({
        customerId: user.uid,
        customerEmail: user.email || '',
        customerName: user.displayName || user.email || 'Customer',
        projectName: formValue.projectName,
        projectAddress: formValue.projectAddress,
        projectDescription: formValue.projectDescription,
        roofType: formValue.roofType,
        estimatedArea: formValue.estimatedArea,
        priority: formValue.priority
      }, user.uid);

      this.successMessage = 'Order created successfully!';
      this.orderForm.reset({ priority: 'medium' });

      // Redirect to orders list after 1.5 seconds
      setTimeout(() => {
        this.router.navigate(['/dashboard/customer/orders']);
      }, 1500);

    } catch (error) {
      console.error('Error creating order:', error);
      this.errorMessage = 'Failed to create order. Please try again.';
      this.loading = false;
    }
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  hasError(fieldName: string, errorType: string): boolean {
    const field = this.orderForm.get(fieldName);
    return !!(field && field.hasError(errorType) && field.touched);
  }

  getErrorMessage(fieldName: string): string {
    const field = this.orderForm.get(fieldName);

    if (!field || !field.touched) {
      return '';
    }

    if (field.hasError('required')) {
      return `${this.getFieldLabel(fieldName)} is required`;
    }

    if (field.hasError('minlength')) {
      const minLength = field.errors?.['minlength'].requiredLength;
      return `${this.getFieldLabel(fieldName)} must be at least ${minLength} characters`;
    }

    if (field.hasError('min')) {
      return `${this.getFieldLabel(fieldName)} must be greater than 0`;
    }

    return '';
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      'projectName': 'Project name',
      'projectAddress': 'Project address',
      'projectDescription': 'Description',
      'roofType': 'Roof type',
      'estimatedArea': 'Estimated area'
    };
    return labels[fieldName] || fieldName;
  }

  cancel(): void {
    this.router.navigate(['/dashboard/customer/orders']);
  }
}
