import { Component, inject, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { OrderService, Order } from '../../../../../core/services/order.service';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-detail.html',
  styleUrl: './order-detail.scss',
})
export class OrderDetail implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private orderService = inject(OrderService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  order: Order | null = null;
  loading = true;
  error = '';

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('orderId');
    if (orderId) {
      this.loadOrder(orderId);
    } else {
      this.error = 'Order ID not found';
      this.loading = false;
    }
  }

  async loadOrder(orderId: string): Promise<void> {
    try {
      const order = await this.orderService.getOrder(orderId);
      this.ngZone.run(() => {
        if (order) {
          this.order = order;
        } else {
          this.error = 'Order not found';
        }
        this.loading = false;
        this.cdr.detectChanges();
      });
    } catch (err) {
      console.error('Error loading order:', err);
      this.ngZone.run(() => {
        this.error = 'Failed to load order details';
        this.loading = false;
        this.cdr.detectChanges();
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/dashboard/customer/orders']);
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

  formatDate(timestamp: any): string {
    if (!timestamp) return 'N/A';

    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch {
      return 'N/A';
    }
  }

  formatShortDate(timestamp: any): string {
    if (!timestamp) return 'N/A';

    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch {
      return 'N/A';
    }
  }

  getPriorityClass(priority: string): string {
    return priority === 'high' ? 'priority-high' : priority === 'medium' ? 'priority-medium' : 'priority-low';
  }
}
