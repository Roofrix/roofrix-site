import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { OrderService, Order, OrderStatus } from '../../../../core/services/order.service';
import { UserService } from '../../../../core/services/user.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './orders.html',
  styleUrl: './orders.scss',
})
export class AdminOrders implements OnInit, OnDestroy {
  private orderService = inject(OrderService);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private sanitizer = inject(DomSanitizer);
  private ordersSubscription: Subscription | null = null;

  orders: Order[] = [];
  filteredOrders: Order[] = [];
  loading = true;
  error = '';

  // Search and filter
  searchQuery = '';
  statusFilter: OrderStatus | 'all' = 'all';

  // Status change modal
  showStatusModal = false;
  selectedOrder: Order | null = null;
  newStatus: OrderStatus = 'pending';
  statusNotes = '';
  updatingStatus = false;


  // Job Details modal
  showDetailsModal = false;
  detailsOrder: Order | null = null;
  currentItemIndex = 0;

  // Delete modal
  showDeleteModal = false;
  orderToDelete: Order | null = null;
  deleting = false;

  // Snackbar
  showSnackbar = false;
  snackbarMessage = '';
  snackbarType: 'success' | 'error' = 'success';

  ngOnInit(): void {
    this.loadOrders();
  }

  ngOnDestroy(): void {
    // Clean up subscription to prevent memory leaks
    if (this.ordersSubscription) {
      this.ordersSubscription.unsubscribe();
    }
  }

  loadOrders(): void {
    this.loading = true;
    this.error = '';

    // Use real-time listener with limit for better performance
    this.ordersSubscription = this.orderService.allOrdersListener(100).subscribe({
      next: (orders) => {
        // Run inside NgZone to ensure change detection triggers
        this.ngZone.run(() => {
          this.orders = orders;
          this.filterOrders();
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          console.error('Error loading orders:', err);
          this.error = 'Failed to load orders';
          this.loading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }


  filterOrders(): void {
    let filtered = [...this.orders];

    // Apply search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(order =>
        order.orderNumber.toLowerCase().includes(query) ||
        order.customerName.toLowerCase().includes(query) ||
        order.customerEmail.toLowerCase().includes(query) ||
        (order.projectName || '').toLowerCase().includes(query) ||
        (order.items || []).some(item => item.projectAddress.toLowerCase().includes(query))
      );
    }

    // Apply status filter
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === this.statusFilter);
    }

    this.filteredOrders = filtered;
  }

  onSearchChange(): void {
    this.filterOrders();
  }

  onStatusFilterChange(): void {
    this.filterOrders();
  }

  openStatusModal(order: Order): void {
    this.selectedOrder = order;
    this.newStatus = order.status;
    this.statusNotes = '';
    this.showStatusModal = true;
  }

  closeStatusModal(): void {
    this.showStatusModal = false;
    this.selectedOrder = null;
    this.statusNotes = '';
  }

  async updateOrderStatus(): Promise<void> {
    if (!this.selectedOrder) return;

    const user = this.authService.getCurrentUser();
    if (!user) return;

    try {
      this.updatingStatus = true;

      await this.orderService.updateOrderStatus(
        this.selectedOrder.id,
        this.newStatus,
        user.uid,
        user.email || 'admin',
        this.statusNotes || undefined
      );

      // Orders will auto-update via real-time listener
      this.closeStatusModal();
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update order status');
    } finally {
      this.updatingStatus = false;
    }
  }


  openDetailsModal(order: Order): void {
    this.detailsOrder = order;
    this.currentItemIndex = 0;
    this.showDetailsModal = true;
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.detailsOrder = null;
    this.currentItemIndex = 0;
  }

  // Item navigation for multi-item orders
  getCurrentItem(): any {
    if (!this.detailsOrder?.items || this.detailsOrder.items.length === 0) {
      return null;
    }
    return this.detailsOrder.items[this.currentItemIndex];
  }

  previousItem(): void {
    if (this.currentItemIndex > 0) {
      this.currentItemIndex--;
    }
  }

  nextItem(): void {
    if (this.detailsOrder?.items && this.currentItemIndex < this.detailsOrder.items.length - 1) {
      this.currentItemIndex++;
    }
  }

  hasMultipleItems(): boolean {
    return (this.detailsOrder?.items?.length || 0) > 1;
  }

  openDeleteModal(order: Order): void {
    this.orderToDelete = order;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.orderToDelete = null;
  }

  async deleteOrder(): Promise<void> {
    if (!this.orderToDelete) return;

    const orderId = this.orderToDelete.id;
    this.deleting = true;
    this.cdr.detectChanges();

    try {
      await this.orderService.deleteOrder(orderId);
      this.ngZone.run(() => {
        this.deleting = false;
        this.closeDeleteModal();
        this.showNotification('Order deleted successfully', 'success');
        this.cdr.detectChanges();
      });
    } catch (err) {
      console.error('Error deleting order:', err);
      this.ngZone.run(() => {
        this.deleting = false;
        this.closeDeleteModal();
        this.showNotification('Failed to delete order', 'error');
        this.cdr.detectChanges();
      });
    }
  }

  showNotification(message: string, type: 'success' | 'error'): void {
    this.snackbarMessage = message;
    this.snackbarType = type;
    this.showSnackbar = true;
    this.cdr.detectChanges();

    // Auto-hide after 3 seconds
    setTimeout(() => {
      this.ngZone.run(() => {
        this.showSnackbar = false;
        this.cdr.detectChanges();
      });
    }, 3000);
  }

  closeSnackbar(): void {
    this.showSnackbar = false;
  }

  formatDateTime(timestamp: any): string {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(date);
    } catch {
      return 'N/A';
    }
  }

  getMapUrl(address: string, location?: { lat: number; lng: number } | null): SafeResourceUrl {
    let url: string;
    if (location?.lat && location?.lng) {
      url = `https://www.google.com/maps?q=${location.lat},${location.lng}&z=18&output=embed`;
    } else {
      const encodedAddress = encodeURIComponent(address);
      url = `https://www.google.com/maps?q=${encodedAddress}&output=embed`;
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  getFileType(name: string): 'image' | 'pdf' | 'other' {
    const lower = name.toLowerCase();
    if (lower.endsWith('.pdf')) return 'pdf';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp')) return 'image';
    return 'other';
  }


  getStatusClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'order_placed': 'status-order-placed',
      'payment_pending': 'status-payment-pending',
      'payment_accepted': 'status-payment-accepted',
      'work_not_started': 'status-work-not-started',
      'in_progress': 'status-in-progress',
      'on_hold': 'status-on-hold',
      'work_completed': 'status-work-completed',
      'sent_for_review': 'status-sent-for-review',
      'customer_approved': 'status-customer-approved',
      'project_closed': 'status-project-closed',
      // Legacy statuses
      'pending': 'status-pending',
      'review': 'status-review',
      'completed': 'status-completed',
      'cancelled': 'status-cancelled'
    };
    return statusClasses[status] || 'status-pending';
  }

  getStatusLabel(status: string): string {
    const statusLabels: { [key: string]: string } = {
      'order_placed': 'Order Placed',
      'payment_pending': 'Payment Pending',
      'payment_accepted': 'Payment Accepted',
      'work_not_started': 'Work Not Started',
      'in_progress': 'In Progress',
      'on_hold': 'On Hold',
      'work_completed': 'Work Completed',
      'sent_for_review': 'Sent for Review',
      'customer_approved': 'Customer Approved',
      'project_closed': 'Project Closed',
      // Legacy statuses
      'pending': 'Pending',
      'review': 'Under Review',
      'completed': 'Completed',
      'cancelled': 'Cancelled'
    };
    return statusLabels[status] || status;
  }

  // Priority methods
  isRushOrder(order: Order): boolean {
    return (order.items || []).some(item =>
      item.addons?.some(addon =>
        addon.name.toLowerCase().includes('rush') || addon.id?.includes('rush')
      )
    );
  }

  getPriorityLabel(order: Order): string {
    return this.isRushOrder(order) ? '2hr Rush' : 'Standard';
  }

  // Timer methods - countdown from order creation
  getRemainingTime(order: Order): { hours: number; minutes: number; totalMs: number } {
    if (!order.createdAt) return { hours: 0, minutes: 0, totalMs: 0 };

    const createdDate = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
    const now = new Date();
    const elapsed = now.getTime() - createdDate.getTime();

    const totalAllowedMs = this.isRushOrder(order) ? 2 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000;
    const remaining = totalAllowedMs - elapsed;

    const absRemaining = Math.abs(remaining);
    const hours = Math.floor(absRemaining / (1000 * 60 * 60));
    const minutes = Math.floor((absRemaining % (1000 * 60 * 60)) / (1000 * 60));

    return { hours, minutes, totalMs: remaining };
  }

  getCountdownDisplay(order: Order): string {
    if (!order.createdAt) return '--';

    const { hours, minutes, totalMs } = this.getRemainingTime(order);

    if (totalMs <= 0) {
      return `-${hours}h ${minutes}m`;
    }
    return `${hours}h ${minutes}m`;
  }

  getTimeClass(order: Order): string {
    if (!order.createdAt) return '';

    const { totalMs } = this.getRemainingTime(order);

    if (totalMs <= 0) return 'time-overdue';
    if (totalMs < 30 * 60 * 1000) return 'time-urgent';
    if (totalMs < 60 * 60 * 1000) return 'time-warning';
    return 'time-normal';
  }

  formatDate(timestamp: any): string {
    if (!timestamp) return 'N/A';

    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).format(date);
    } catch {
      return 'N/A';
    }
  }

  getPriorityClass(order: Order): string {
    return this.isRushOrder(order) ? 'priority-rush' : 'priority-standard';
  }
}
