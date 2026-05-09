import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { OrderService, Order } from '../../../../../core/services/order.service';
import { STATUS_LABELS, STATUS_CLASSES } from '../../../../../core/constants/order.constants';
import { FormatDatePipe } from '../../../../../shared/pipes/format-date.pipe';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, FormatDatePipe],
  templateUrl: './order-detail.html',
  styleUrl: './order-detail.scss',
})
export class OrderDetail implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private orderService = inject(OrderService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private orderSubscription: Subscription | null = null;

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

  ngOnDestroy(): void {
    if (this.orderSubscription) {
      this.orderSubscription.unsubscribe();
    }
  }

  loadOrder(orderId: string): void {
    this.orderSubscription = this.orderService.orderListener(orderId).subscribe({
      next: (order) => {
        this.ngZone.run(() => {
          if (order) {
            this.order = order;
          } else {
            this.error = 'Order not found';
          }
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.error = 'Failed to load order details';
          this.loading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/customer/orders']);
  }

  getStatusClass(status: string): string {
    return STATUS_CLASSES[status] || 'status-pending';
  }

  getStatusLabel(status: string): string {
    return STATUS_LABELS[status] || status;
  }

  getPriorityClass(priority: string): string {
    return priority === 'high' ? 'priority-high' : priority === 'medium' ? 'priority-medium' : 'priority-low';
  }
}
