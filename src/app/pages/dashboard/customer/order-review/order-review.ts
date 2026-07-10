import { Component, inject, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { OrderService, CreateOrderData, OrderItem } from '../../../../core/services/order.service';
import { AuthService } from '../../../../core/services/auth.service';
import { CartService, CartItem } from '../../../../core/services/cart.service';
import { firstValueFrom } from 'rxjs';
import { StorageService } from '../../../../core/services/storage.service';
import { FileTransferService } from '../../../../core/services/file-transfer.service';
import { UserService } from '../../../../core/services/user.service';
import { EmailNotificationService } from '../../../../core/services/email-notification.service';

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
  private userService = inject(UserService);
  private emailNotificationService = inject(EmailNotificationService);

  orderData: any = null;
  cartItems: CartItem[] = [];
  isCartCheckout = false;
  cartTotal = 0;
  orderConfirmed = false;
  orderNumber = '';
  orderId = '';
  orderNumbers: string[] = [];
  orderIds: string[] = [];
  loading = false;
  uploadingFiles = false;
  uploadProgress = '';
  errorMessage = '';
  uploadWarning = '';

  ngOnInit(): void {
    // Check if coming from cart checkout
    const fromCart = this.route.snapshot.queryParamMap.get('fromCart');

    if (fromCart === 'true') {
      // Cart checkout flow
      const cartData = sessionStorage.getItem('cartCheckout');
      if (cartData) {
        try {
          const parsed = JSON.parse(cartData);
          this.cartItems = parsed.items || [];
          this.cartTotal = parsed.totalPrice || 0;
          this.isCartCheckout = true;
        } catch {
          this.router.navigate(['/dashboard/customer/cart']);
        }
      } else {
        this.router.navigate(['/dashboard/customer/cart']);
      }
    } else {
      // Single item checkout flow
      const stored = sessionStorage.getItem('orderData');
      if (stored) {
        try {
          this.orderData = JSON.parse(stored);
        } catch {
          this.router.navigate(['/dashboard/customer/orders']);
        }
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
      this.ngZone.run(() => {
        this.errorMessage = 'Failed to create order. Please try again.';
        this.loading = false;
        this.cdr.detectChanges();
      });
    }
  }

  private async createSingleOrder(user: any): Promise<void> {
    // Validate required data
    if (!this.orderData.location?.lat || !this.orderData.location?.lng) {
      this.errorMessage = 'Invalid location data. Please go back and confirm the location.';
      this.loading = false;
      return;
    }
    if (!this.orderData.reportType?.id || !this.orderData.reportType?.price) {
      this.errorMessage = 'Invalid report type. Please go back and select a report type.';
      this.loading = false;
      return;
    }

    // Build single item from order data
    const address = this.orderData.location.address || this.orderData.address;
    const item: OrderItem = {
      projectAddress: address,
      location: { lat: this.orderData.location.lat, lng: this.orderData.location.lng },
      reportType: this.orderData.reportType,
      addons: this.orderData.addons || [],
      structureCategory: this.orderData.structureCategory || 'basic',
      structureCategoryName: this.orderData.structureCategoryName || 'Basic Structure',
      structureCategorySqRange: this.orderData.structureCategorySqRange || '< 30 SQs',
      primaryPitch: this.orderData.primaryPitch || '',
      secondaryPitch: this.orderData.secondaryPitch || '',
      structureType: this.orderData.structureType || '',
      specialInstructions: this.orderData.specialInstructions || '',
      basePrice: this.orderData.basePrice,
      addonsTotal: this.orderData.addonsTotal,
      totalPrice: this.orderData.totalPrice,
    };

    const userProfile = await this.userService.getUserProfile(user.uid!);

    const orderData: CreateOrderData = {
      customerId: user.uid!,
      customerEmail: user.email || '',
      customerName: userProfile?.name || user.email || 'Customer',
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
        this.uploadWarning = 'Your order was placed, but some files failed to upload. Please contact support if needed.';
      }

    }

    // Clear all session data and files
    this.fileTransferService.clear();
    sessionStorage.removeItem('orderData');
    sessionStorage.removeItem('selectedStructureType');

    // Send email notification to admin
    const emailResult = await this.emailNotificationService.sendNewOrderNotification({
      orderNumber: this.orderNumber,
      customerName: orderData.customerName,
      customerEmail: orderData.customerEmail,
      totalPrice: orderData.totalPrice,
      itemCount: 1,
      projectAddress: item.projectAddress
    });
    if (!emailResult.success && !this.uploadWarning) {
      this.uploadWarning = 'Order placed, but the admin notification email could not be sent.';
    }

    // Send rush order notification if applicable
    const hasRushAddon = (this.orderData.addons || []).some(
      (addon: any) => addon.name.toLowerCase().includes('rush') || addon.id?.includes('rush')
    );
    if (hasRushAddon) {
      this.emailNotificationService.sendRushOrderNotification({
        orderNumber: this.orderNumber,
        customerName: orderData.customerName,
        reportType: item.reportType?.name || '',
        itemCount: 1,
        projectAddress: item.projectAddress
      });
    }

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
    const userProfile = await this.userService.getUserProfile(user.uid!);
    const customerName = userProfile?.name || user.email || 'Customer';
    const customerEmail = user.email || '';

    const createdOrderNumbers: string[] = [];
    const createdOrderIds: string[] = [];

    for (let i = 0; i < this.cartItems.length; i++) {
      const item = this.cartItems[i];

      const orderItem: OrderItem = {
        projectAddress: item.projectAddress,
        location: item.location,
        reportType: item.reportType,
        addons: item.selectedAddons,
        structureCategory: item.structureCategory,
        structureCategoryName: item.structureCategoryName,
        structureCategorySqRange: item.structureCategorySqRange,
        primaryPitch: item.primaryPitch || '',
        secondaryPitch: item.secondaryPitch || '',
        structureType: item.structureType || '',
        specialInstructions: item.specialInstructions,
        basePrice: item.basePrice,
        addonsTotal: item.addonsTotal,
        totalPrice: item.totalPrice
      };

      const orderData: CreateOrderData = {
        customerId: user.uid!,
        customerEmail: customerEmail,
        customerName: customerName,
        totalPrice: item.totalPrice,
        priority: 'medium',
        items: [orderItem]
      };

      const createdOrderId = await this.orderService.createOrder(orderData, user.uid!);
      const createdOrder = await this.orderService.getOrder(createdOrderId);
      const orderNumber = createdOrder?.orderNumber || createdOrderId;

      createdOrderNumbers.push(orderNumber);
      createdOrderIds.push(createdOrderId);

      // Upload files for this item
      const itemFiles = this.fileTransferService.getCartItemFiles(item.id);
      if (itemFiles.length > 0) {
        this.ngZone.run(() => {
          this.uploadingFiles = true;
          this.uploadProgress = `Uploading files for item ${i + 1}/${this.cartItems.length}...`;
          this.cdr.detectChanges();
        });

        try {
          const urls = await this.storageService.uploadMultipleFiles(
            itemFiles, 'site-images', user.uid!, createdOrderId
          );
          orderItem.siteImages = urls.map((url, j) => ({ url, name: itemFiles[j].name }));
          await this.orderService.updateOrder(createdOrderId, { items: [orderItem] });
        } catch (uploadError) {
          this.uploadWarning = 'Some orders were placed, but some files failed to upload.';
        }
      }

      // Send email notification per order
      const emailResult = await this.emailNotificationService.sendNewOrderNotification({
        orderNumber: orderNumber,
        customerName: customerName,
        customerEmail: customerEmail,
        totalPrice: item.totalPrice,
        itemCount: 1,
        projectAddress: item.projectAddress
      });
      if (!emailResult.success && !this.uploadWarning) {
        this.uploadWarning = 'Order placed, but the admin notification email could not be sent.';
      }

      // Send rush order notification if applicable
      const hasRushAddon = (item.selectedAddons || []).some(
        (addon: any) => addon.name.toLowerCase().includes('rush') || addon.id?.includes('rush')
      );
      if (hasRushAddon) {
        this.emailNotificationService.sendRushOrderNotification({
          orderNumber: orderNumber,
          customerName: customerName,
          reportType: item.reportType?.name || '',
          itemCount: 1,
          projectAddress: item.projectAddress
        });
      }
    }

    this.orderNumbers = createdOrderNumbers;
    this.orderIds = createdOrderIds;

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
    if (this.orderIds.length > 0) {
      this.router.navigate(['/dashboard/customer/orders']);
    } else if (this.orderId) {
      this.router.navigate(['/dashboard/customer/orders', this.orderId]);
    } else {
      this.router.navigate(['/dashboard/customer/orders']);
    }
  }

  goToOrders(): void {
    this.router.navigate(['/dashboard/customer/orders']);
  }
}
