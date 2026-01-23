import { Component, inject, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { OrderService, CreateOrderData } from '../../../../core/services/order.service';
import { AuthService } from '../../../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-order-review',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-review.html',
  styleUrl: './order-review.scss',
})
export class OrderReview implements OnInit {
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private orderService = inject(OrderService);
  private authService = inject(AuthService);

  orderData: any = null;
  orderConfirmed = false;
  orderNumber = '';
  loading = false;
  errorMessage = '';

  ngOnInit(): void {
    const stored = sessionStorage.getItem('orderData');
    if (stored) {
      this.orderData = JSON.parse(stored);
    } else {
      this.router.navigate(['/dashboard/customer/orders/products']);
    }
  }

  goBack(): void {
    this.router.navigate(['/dashboard/customer/new-order']);
  }

  async confirmOrder(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';

    try {
      // Get current user
      const user = await firstValueFrom(this.authService.currentUser$);
      if (!user) {
        this.errorMessage = 'Please sign in to place an order';
        this.loading = false;
        return;
      }

      // Prepare order data with latitude, longitude, and structure category
      const orderData: CreateOrderData = {
        customerId: user.uid!,
        customerEmail: user.email || '',
        customerName: user.displayName || user.email || 'Customer',
        projectAddress: this.orderData.address,
        latitude: this.orderData.latitude || null,
        longitude: this.orderData.longitude || null,
        location: this.orderData.location || null,
        reportType: this.orderData.reportType,
        addons: this.orderData.addons || [],
        // Structure category from menu selection
        structureCategory: this.orderData.structureCategory || 'basic',
        structureCategoryName: this.orderData.structureCategoryName || 'Basic Structure',
        structureCategorySqRange: this.orderData.structureCategorySqRange || '< 30 SQs',
        primaryPitch: this.orderData.primaryPitch || '',
        secondaryPitch: this.orderData.secondaryPitch || '',
        specialInstructions: this.orderData.specialInstructions || '',
        basePrice: this.orderData.basePrice,
        addonsTotal: this.orderData.addonsTotal,
        totalPrice: this.orderData.totalPrice,
        priority: 'medium'
      };

      // Save to Firestore and get the order ID
      const orderId = await this.orderService.createOrder(orderData, user.uid!);

      // Get the generated order number from the service
      this.orderNumber = 'ORD-' + orderId.slice(-8).toUpperCase();

      this.ngZone.run(() => {
        this.loading = false;
        this.orderConfirmed = true;

        // Clear session storage
        sessionStorage.removeItem('selectedProduct');
        sessionStorage.removeItem('orderData');

        // Force change detection
        this.cdr.detectChanges();
      });
    } catch (error) {
      console.error('Error creating order:', error);
      this.ngZone.run(() => {
        this.errorMessage = 'Failed to create order. Please try again.';
        this.loading = false;
        this.cdr.detectChanges();
      });
    }
  }

  goToProducts(): void {
    this.router.navigate(['/dashboard/customer/orders/products']);
  }

  goToOrders(): void {
    this.router.navigate(['/dashboard/customer/orders']);
  }
}
