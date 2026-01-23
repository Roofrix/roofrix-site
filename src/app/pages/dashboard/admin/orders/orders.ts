import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
      'pending': 'status-pending',
      'in_progress': 'status-in-progress',
      'review': 'status-review',
      'completed': 'status-completed',
      'cancelled': 'status-cancelled'
    };
    return statusClasses[status] || 'status-pending';
  }

  getStatusLabel(status: string): string {
    const statusLabels: { [key: string]: string } = {
      'pending': 'Pending',
      'in_progress': 'In Progress',
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

  getPriorityClass(priority?: string): string {
    if (priority === 'high') return 'priority-high';
    if (priority === 'medium') return 'priority-medium';
    return 'priority-low';
  }
}
