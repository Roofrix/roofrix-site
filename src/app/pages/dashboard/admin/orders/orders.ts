import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { OrderService, Order, OrderStatus } from '../../../../core/services/order.service';
import { UserService, UserProfile } from '../../../../core/services/user.service';
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
  designers: UserProfile[] = [];
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

  // Designer assignment modal
  showDesignerModal = false;
  selectedDesignerId = '';
  assigningDesigner = false;

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
    this.loadDesigners();
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

  async loadDesigners(): Promise<void> {
    try {
      this.designers = await this.userService.getUsersByRole('designer');
    } catch (err) {
      console.error('Error loading designers:', err);
    }
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
        order.projectAddress.toLowerCase().includes(query)
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
        'admin',
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

  openDesignerModal(order: Order): void {
    this.selectedOrder = order;
    this.selectedDesignerId = order.assignedDesignerId || '';
    this.showDesignerModal = true;
  }

  closeDesignerModal(): void {
    this.showDesignerModal = false;
    this.selectedOrder = null;
    this.selectedDesignerId = '';
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

  getMapUrl(address: string): SafeResourceUrl {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://www.google.com/maps?q=${encodedAddress}&output=embed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  async assignDesigner(): Promise<void> {
    if (!this.selectedOrder || !this.selectedDesignerId) return;

    try {
      this.assigningDesigner = true;

      const designer = this.designers.find(d => d.id === this.selectedDesignerId);
      if (!designer) return;

      const user = this.authService.getCurrentUser();
      await this.orderService.assignDesigner(
        this.selectedOrder.id,
        designer.id,
        designer.email,
        user?.uid || '',
        user?.email || 'admin'
      );

      // Update designer's assigned orders
      await this.userService.assignOrderToDesigner(designer.id, this.selectedOrder.id);

      // Orders will auto-update via real-time listener
      this.closeDesignerModal();
    } catch (err) {
      console.error('Error assigning designer:', err);
      alert('Failed to assign designer');
    } finally {
      this.assigningDesigner = false;
    }
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

  // Timer methods
  isRushOrder(order: Order): boolean {
    return order.addons?.some(addon =>
      addon.name.toLowerCase().includes('rush') || addon.id?.includes('rush')
    ) || false;
  }

  isActiveWork(order: Order): boolean {
    return order.status === 'in_progress' && !!order.workStartedAt;
  }

  getCountdownTime(order: Order): string {
    if (!order.rushDeadline) return '--';

    const deadline = order.rushDeadline.toDate ? order.rushDeadline.toDate() : new Date(order.rushDeadline);
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();

    if (diff <= 0) return 'Overdue';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  }

  getRunningTime(order: Order): string {
    if (!order.workStartedAt) return '--';

    const startTime = order.workStartedAt.toDate ? order.workStartedAt.toDate() : new Date(order.workStartedAt);
    const now = new Date();
    const diff = now.getTime() - startTime.getTime();

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  }

  getTimeClass(order: Order): string {
    if (this.isRushOrder(order)) {
      const deadline = order.rushDeadline?.toDate ? order.rushDeadline.toDate() : new Date(order.rushDeadline);
      const now = new Date();
      const diff = deadline?.getTime() - now.getTime();

      if (diff <= 0) return 'time-overdue';
      if (diff < 30 * 60 * 1000) return 'time-urgent'; // Less than 30 minutes
      if (diff < 60 * 60 * 1000) return 'time-warning'; // Less than 1 hour
      return 'time-normal';
    }
    return 'time-active';
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

  getPriorityClass(priority?: string): string {
    if (priority === 'high') return 'priority-high';
    if (priority === 'medium') return 'priority-medium';
    return 'priority-low';
  }
}
