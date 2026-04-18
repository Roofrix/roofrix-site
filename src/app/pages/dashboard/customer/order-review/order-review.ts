import { Component, inject, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { OrderService, CreateOrderData, OrderItem } from '../../../../core/services/order.service';
import { AuthService } from '../../../../core/services/auth.service';
import { CartService, CartItem } from '../../../../core/services/cart.service';
import { firstValueFrom } from 'rxjs';
import { StorageService } from '../../../../core/services/storage.service';
import { FileTransferService } from '../../../../core/services/file-transfer.service';

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
  private storageService = inject(StorageService);
  private fileTransferService = inject(FileTransferService);

  orderData: any = null;
  cartItems: CartItem[] = [];
  isCartCheckout = false;
  cartTotal = 0;
  orderConfirmed = false;
  orderNumber = '';
  orderId = '';
  loading = false;
  uploadingFiles = false;
  uploadProgress = '';
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
    // Build single item from order data
    const address = this.orderData.location?.address || this.orderData.address;
    const addressParts = address.split(',');
    const item: OrderItem = {
      projectName: addressParts[0] || 'Rooftop Project',
      projectAddress: address,
      location: this.orderData.location ? { lat: this.orderData.location.lat, lng: this.orderData.location.lng } : { lat: 0, lng: 0 },
      reportType: this.orderData.reportType,
      addons: this.orderData.addons || [],
      structureCategory: this.orderData.structureCategory || 'basic',
      structureCategoryName: this.orderData.structureCategoryName || 'Basic Structure',
      structureCategorySqRange: this.orderData.structureCategorySqRange || '< 30 SQs',
      primaryPitch: this.orderData.primaryPitch || '',
      secondaryPitch: this.orderData.secondaryPitch || '',
      specialInstructions: this.orderData.specialInstructions || '',
      basePrice: this.orderData.basePrice,
      addonsTotal: this.orderData.addonsTotal,
      totalPrice: this.orderData.totalPrice,
    };

    const orderData: CreateOrderData = {
      customerId: user.uid!,
      customerEmail: user.email || '',
      customerName: user.displayName || user.email || 'Customer',
      totalPrice: this.orderData.totalPrice,
      priority: 'medium',
      items: [item]
    };

    // Save to Firestore and get the order ID
    const createdOrderId = await this.orderService.createOrder(orderData, user.uid!);

    // Store the order ID for navigation
    this.orderId = createdOrderId;

    // Get the generated order number from the service
    const createdOrder = await this.orderService.getOrder(createdOrderId);
    this.orderNumber = createdOrder?.orderNumber || createdOrderId;

    // Upload files to Firebase Storage if any
    const files = this.fileTransferService.getFiles();
    console.log('[ORDER-REVIEW] Files from transfer service:', files.length, files);
    if (files.length > 0) {
      this.ngZone.run(() => {
        this.uploadingFiles = true;
        this.uploadProgress = `Uploading ${files.length} file(s)...`;
        this.cdr.detectChanges();
      });

      try {
        const downloadURLs = await this.storageService.uploadMultipleFiles(
          files, 'site-images', user.uid!, createdOrderId
        );
        item.siteImages = downloadURLs.map((url, i) => ({ url, name: files[i].name }));
        await this.orderService.updateOrder(createdOrderId, { items: [item] });
      } catch (uploadError) {
        console.error('[ORDER-REVIEW] File upload failed:', uploadError);
        // Order is created, just log the upload error — don't block confirmation
      }

    }

    // Clear all session data and files
    this.fileTransferService.clear();
    sessionStorage.removeItem('selectedProduct');
    sessionStorage.removeItem('orderData');
    sessionStorage.removeItem('selectedStructureType');

    this.ngZone.run(() => {
      this.loading = false;
      this.uploadingFiles = false;
      this.uploadProgress = '';
      this.orderConfirmed = true;

      // Force change detection
      this.cdr.detectChanges();
    });
  }

  private async createCartOrder(user: any): Promise<void> {
    // Build items array for the order
    const orderItems: OrderItem[] = this.cartItems.map(item => ({
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

    const orderData: CreateOrderData = {
      customerId: user.uid!,
      customerEmail: user.email || '',
      customerName: user.displayName || user.email || 'Customer',
      totalPrice: this.cartTotal,
      priority: 'medium',
      items: orderItems
    };

    // Save to Firestore
    const createdOrderId = await this.orderService.createOrder(orderData, user.uid!);

    this.orderId = createdOrderId;
    const createdOrder = await this.orderService.getOrder(createdOrderId);
    this.orderNumber = createdOrder?.orderNumber || createdOrderId;

    // Upload files per cart item
    const hasFiles = this.fileTransferService.hasFiles();

    if (hasFiles) {
      this.ngZone.run(() => {
        this.uploadingFiles = true;
        this.cdr.detectChanges();
      });

      for (let i = 0; i < this.cartItems.length; i++) {
        const cartItem = this.cartItems[i];
        const itemFiles = this.fileTransferService.getCartItemFiles(cartItem.id);

        if (itemFiles.length > 0) {
          this.ngZone.run(() => {
            this.uploadProgress = `Uploading files for item ${i + 1}/${this.cartItems.length}...`;
            this.cdr.detectChanges();
          });

          try {
            const urls = await this.storageService.uploadMultipleFiles(
              itemFiles, 'site-images', user.uid!, createdOrderId
            );
            orderItems[i].siteImages = urls.map((url, j) => ({ url, name: itemFiles[j].name }));
          } catch (uploadError) {
            console.error(`[ORDER-REVIEW] File upload failed for item ${i + 1}:`, uploadError);
          }
        }
      }

      try {
        await this.orderService.updateOrder(createdOrderId, { items: orderItems });
      } catch (err) {
        console.error('[ORDER-REVIEW] Failed to update order with file URLs:', err);
      }

    }

    // Clear all session data and files
    this.fileTransferService.clear();
    this.cartService.clearCart();
    sessionStorage.removeItem('cartCheckout');
    sessionStorage.removeItem('orderData');
    sessionStorage.removeItem('selectedStructureType');

    this.ngZone.run(() => {
      this.loading = false;
      this.uploadingFiles = false;
      this.uploadProgress = '';
      this.orderConfirmed = true;
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
