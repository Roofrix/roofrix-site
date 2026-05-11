import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { OrderService, Order } from '../../../../core/services/order.service';
import { UserService } from '../../../../core/services/user.service';
import { COMPLETED_STATUSES, CANCELLED_STATUSES, STATUS_LABELS, STATUS_CLASSES } from '../../../../core/constants/order.constants';
import { FormatDatePipe } from '../../../../shared/pipes/format-date.pipe';

@Component({
  selector: 'app-customer-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, FormatDatePipe],
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
        error: () => {
          this.ngZone.run(() => {
            this.error = 'Failed to load orders';
            this.loading = false;
            this.cdr.detectChanges();
          });
        }
      });
    });
  }

  computeStats(): void {
    const activeOrders = this.allOrders;
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

  getAddons(order: Order): string {
    const addons = order.items?.[0]?.addons;
    if (!addons || addons.length === 0) return 'None';
    return addons.map(a => a.name).join(', ');
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

  getStatusClass(status: string): string {
    return STATUS_CLASSES[status] || 'status-pending';
  }

  getStatusLabel(status: string): string {
    return STATUS_LABELS[status] || status;
  }

  getImageCount(order: Order): number {
    return (order.items || []).reduce((sum, item) => sum + (item.siteImages?.length || 0), 0);
  }

  viewOrderDetails(orderId: string): void {
    this.router.navigate(['/dashboard/customer/orders', orderId]);
  }

  createNewOrder(): void {
    this.router.navigate(['/dashboard/customer/orders/products']);
  }

}
