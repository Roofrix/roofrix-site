import { Component, inject, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { OrderService, CreateOrderData } from '../../../../core/services/order.service';
import { AuthService } from '../../../../core/services/auth.service';
import { CartService, CartItem } from '../../../../core/services/cart.service';
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
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private orderService = inject(OrderService);
  private authService = inject(AuthService);
  private cartService = inject(CartService);

  orderData: any = null;
  cartItems: CartItem[] = [];
  isCartCheckout = false;
  cartTotal = 0;
  orderConfirmed = false;
  orderNumber = '';
  orderId = '';
  loading = false;
  errorMessage = '';

  ngOnInit(): void {
    // Check if coming from cart checkout
    const fromCart = this.route.snapshot.queryParamMap.get('fromCart');

    if (fromCart === 'true') {
      // Cart checkout flow
      const cartData = sessionStorage.getItem('cartCheckout');
      if (cartData) {
        const parsed = JSON.parse(cartData);
        this.cartItems = parsed.items || [];
        this.cartTotal = parsed.totalPrice || 0;
        this.isCartCheckout = true;
      } else {
        this.router.navigate(['/dashboard/customer/cart']);
      }
    } else {
      // Single item checkout flow
      const stored = sessionStorage.getItem('orderData');
      if (stored) {
        this.orderData = JSON.parse(stored);
      } else {
        this.router.navigate(['/dashboard/customer/orders']);
      }
    }
  }

  goBack(): void {
    if (this.isCartCheckout) {
      this.router.navigate(['/dashboard/customer/cart']);
    } else {
      this.router.navigate(['/dashboard/customer/new-order']);
    }
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

      if (this.isCartCheckout) {
        // Cart checkout - create order with multiple items
        await this.createCartOrder(user);
      } else {
        // Single item checkout
        await this.createSingleOrder(user);
      }
    } catch (error) {
      console.error('Error creating order:', error);
      this.ngZone.run(() => {
        this.errorMessage = 'Failed to create order. Please try again.';
        this.loading = false;
        this.cdr.detectChanges();
      });
    }
  }

  private async createSingleOrder(user: any): Promise<void> {
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
    const createdOrderId = await this.orderService.createOrder(orderData, user.uid!);

    // Store the order ID for navigation
    this.orderId = createdOrderId;

    // Get the generated order number from the service
    this.orderNumber = 'ORD-' + createdOrderId.slice(-8).toUpperCase();

    this.ngZone.run(() => {
      this.loading = false;
      this.orderConfirmed = true;

      // Clear session storage
      sessionStorage.removeItem('selectedProduct');
      sessionStorage.removeItem('orderData');

      // Force change detection
      this.cdr.detectChanges();
    });
  }

  private async createCartOrder(user: any): Promise<void> {
    // For cart checkout, we create a single order with multiple items
    // The first item's address becomes the primary project address
    const firstItem = this.cartItems[0];

    // Build items array for the order
    const orderItems = this.cartItems.map(item => ({
      projectName: item.projectName,
      projectAddress: item.projectAddress,
      location: item.location,
      reportType: item.reportType,
      addons: item.selectedAddons,
      structureCategory: item.structureCategory,
      structureCategoryName: item.structureCategoryName,
      structureCategorySqRange: item.structureCategorySqRange,
      specialInstructions: item.specialInstructions,
      basePrice: item.basePrice,
      addonsTotal: item.addonsTotal,
      totalPrice: item.totalPrice
    }));

    // Calculate totals from all items
    const totalBasePrice = this.cartItems.reduce((sum, item) => sum + item.basePrice, 0);
    const totalAddonsPrice = this.cartItems.reduce((sum, item) => sum + item.addonsTotal, 0);

    const orderData: CreateOrderData = {
      customerId: user.uid!,
      customerEmail: user.email || '',
      customerName: user.displayName || user.email || 'Customer',
      projectAddress: `${this.cartItems.length} Project${this.cartItems.length > 1 ? 's' : ''} - ${firstItem.projectName}`,
      latitude: firstItem.location.lat,
      longitude: firstItem.location.lng,
      location: firstItem.location,
      reportType: firstItem.reportType,
      addons: firstItem.selectedAddons || [],
      structureCategory: firstItem.structureCategory,
      structureCategoryName: firstItem.structureCategoryName,
      structureCategorySqRange: firstItem.structureCategorySqRange,
      primaryPitch: '',
      secondaryPitch: '',
      specialInstructions: `Order contains ${this.cartItems.length} item(s)`,
      basePrice: totalBasePrice,
      addonsTotal: totalAddonsPrice,
      totalPrice: this.cartTotal,
      priority: 'medium',
      // Add items array for multi-item orders
      items: orderItems
    };

    // Save to Firestore
    const createdOrderId = await this.orderService.createOrder(orderData, user.uid!);

    this.orderId = createdOrderId;
    this.orderNumber = 'ORD-' + createdOrderId.slice(-8).toUpperCase();

    this.ngZone.run(() => {
      this.loading = false;
      this.orderConfirmed = true;

      // Clear cart and session storage
      this.cartService.clearCart();
      sessionStorage.removeItem('cartCheckout');

      this.cdr.detectChanges();
    });
  }

  goToOrderDetails(): void {
    if (this.orderId) {
      this.router.navigate(['/dashboard/customer/orders', this.orderId]);
    } else {
      this.router.navigate(['/dashboard/customer/orders']);
    }
  }

  goToOrders(): void {
    this.router.navigate(['/dashboard/customer/orders']);
  }
}
