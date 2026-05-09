import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { OrderService, Order } from '../../../../core/services/order.service';
import { UserService } from '../../../../core/services/user.service';

const COMPLETED_STATUSES = new Set([
  'customer_approved',
  'project_closed',
  'completed',
]);

const CANCELLED_STATUSES = new Set([
  'cancelled',
]);

@Component({
  selector: 'app-customer-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './orders.html',
  styleUrl: './orders.scss',
})
export class CustomerOrders implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private orderService = inject(OrderService);
  private userService = inject(UserService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private authSubscription: Subscription | null = null;
  private ordersSubscription: Subscription | null = null;

  // Data
  allOrders: Order[] = [];
  filteredOrders: Order[] = [];
  paginatedOrders: Order[] = [];
  loading = true;
  error = '';

  // Welcome & Stats
  userName = '';
  totalOrders = 0;
  completedCount = 0;
  inProgressCount = 0;

  // Tabs, search, pagination
  activeTab: 'open' | 'completed' | 'cancelled' = 'open';
  searchQuery = '';
  currentPage = 1;
  pageSize = 10;

  // Cancel modal
  showCancelModal = false;
  orderToCancel: Order | null = null;
  cancelling = false;

  ngOnInit(): void {
    this.loadOrders();
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.ordersSubscription?.unsubscribe();
  }

  loadOrders(): void {
    this.authSubscription = this.authService.loading$.pipe(
      filter(loading => !loading),
      take(1)
    ).subscribe(async () => {
      const user = this.authService.getCurrentUser();

      if (!user?.uid) {
        this.error = 'User not authenticated';
        this.loading = false;
        return;
      }

      // Load user name
      try {
        const profile = await this.userService.getUserProfile(user.uid);
        this.userName = profile?.name || user.email || 'User';
      } catch {
        this.userName = user.email || 'User';
      }

      // Subscribe to orders
      this.ordersSubscription = this.orderService.customerOrdersListener(user.uid).subscribe({
        next: (orders) => {
          this.ngZone.run(() => {
            this.allOrders = orders;
            this.computeStats();
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
    });
  }

  computeStats(): void {
    const activeOrders = this.allOrders.filter(o => !o.isDeleted);
    this.totalOrders = activeOrders.length;
    this.completedCount = activeOrders.filter(o => COMPLETED_STATUSES.has(o.status)).length;
    this.inProgressCount = activeOrders.filter(o => o.status === 'in_progress').length;
  }

  switchTab(tab: 'open' | 'completed' | 'cancelled'): void {
    this.activeTab = tab;
    this.currentPage = 1;
    this.filterOrders();
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.filterOrders();
  }

  filterOrders(): void {
    // Tab filter
    let filtered = this.allOrders.filter(order => {
      const isDeleted = order.isDeleted === true;
      const isCancelled = CANCELLED_STATUSES.has(order.status);
      if (this.activeTab === 'cancelled') return isDeleted || isCancelled;
      if (isDeleted) return false; // hide deleted from other tabs
      if (this.activeTab === 'completed') return COMPLETED_STATUSES.has(order.status);
      return !COMPLETED_STATUSES.has(order.status) && !isCancelled;
    });

    // Search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(order =>
        order.orderNumber.toLowerCase().includes(query) ||
        (order.projectName || '').toLowerCase().includes(query) ||
        (order.items || []).some(item =>
          item.projectAddress?.toLowerCase().includes(query) ||
          item.reportType?.name?.toLowerCase().includes(query) ||
          item.structureCategoryName?.toLowerCase().includes(query)
        )
      );
    }

    this.filteredOrders = filtered;
    this.applyPagination();
  }

  applyPagination(): void {
    const start = (this.currentPage - 1) * this.pageSize;
    this.paginatedOrders = this.filteredOrders.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredOrders.length / this.pageSize));
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.applyPagination();
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.applyPagination();
    }
  }

  onPageSizeChange(): void {
    this.pageSize = Number(this.pageSize);
    this.currentPage = 1;
    this.applyPagination();
  }

  // Table helpers
  getReportType(order: Order): string {
    return order.items?.[0]?.reportType?.name || 'N/A';
  }

  getCategory(order: Order): string {
    return order.items?.[0]?.structureCategoryName || 'N/A';
  }

  isRushOrder(order: Order): boolean {
    return (order.items || []).some(item =>
      item.addons?.some(addon =>
        addon.name.toLowerCase().includes('rush') || addon.id?.includes('rush')
      )
    );
  }

  getPriorityLabel(order: Order): string {
    return this.isRushOrder(order) ? 'Rush Order' : 'Standard Order';
  }

  getPriorityClass(order: Order): string {
    return this.isRushOrder(order) ? 'priority-rush' : 'priority-standard';
  }

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
      'pending': 'Pending',
      'review': 'Under Review',
      'completed': 'Completed',
      'cancelled': 'Cancelled'
    };
    return statusLabels[status] || status;
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

  getImageCount(order: Order): number {
    return (order.items || []).reduce((sum, item) => sum + (item.siteImages?.length || 0), 0);
  }

  // Cancel order
  openCancelModal(order: Order): void {
    this.orderToCancel = order;
    this.showCancelModal = true;
  }

  closeCancelModal(): void {
    this.showCancelModal = false;
    this.orderToCancel = null;
  }

  async cancelOrder(): Promise<void> {
    if (!this.orderToCancel) return;

    this.cancelling = true;
    this.cdr.detectChanges();

    try {
      await this.orderService.deleteOrder(this.orderToCancel.id);
      this.ngZone.run(() => {
        this.cancelling = false;
        this.closeCancelModal();
        this.cdr.detectChanges();
      });
    } catch (err) {
      console.error('Error cancelling order:', err);
      this.ngZone.run(() => {
        this.cancelling = false;
        this.closeCancelModal();
        this.cdr.detectChanges();
      });
    }
  }

  viewOrderDetails(orderId: string): void {
    this.router.navigate(['/dashboard/customer/orders', orderId]);
  }

  createNewOrder(): void {
    this.router.navigate(['/dashboard/customer/orders/products']);
  }
}
