import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { OrderService, Order } from '../../../../core/services/order.service';

@Component({
  selector: 'app-customer-orders',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './orders.html',
  styleUrl: './orders.scss',
})
export class CustomerOrders implements OnInit {
  private authService = inject(AuthService);
  private orderService = inject(OrderService);
  private router = inject(Router);

  orders$: Observable<Order[]> | null = null;
  loading = true;
  error = '';

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    const user = this.authService.getCurrentUser();

    if (!user?.uid) {
      this.error = 'User not authenticated';
      this.loading = false;
      return;
    }

    // Use real-time listener for customer orders
    this.orders$ = this.orderService.customerOrdersListener(user.uid);
    this.loading = false;
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

  viewOrderDetails(orderId: string): void {
    this.router.navigate(['/dashboard/customer/orders', orderId]);
  }

  createNewOrder(): void {
    this.router.navigate(['/dashboard/customer/new-order']);
  }
}
