import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';

interface Order {
  id: string;
  orderNumber: string;
  projectName: string;
  projectAddress: string;
  structureType: string;
  primaryPitch?: string;
  secondaryPitch?: string;
  reportType: { id: string; name: string; price: number };
  addons: { id: string; name: string; price: number }[];
  basePrice: number;
  addonsTotal: number;
  totalPrice: number;
  status: string;
  priority: string;
  customerName: string;
  customerEmail: string;
  specialInstructions?: string;
  assignedDesignerId?: string;
  assignedDesignerEmail?: string;
  createdAt: Date;
  statusTimeline: { status: string; changedAt: Date; changedByEmail: string; notes?: string }[];
}

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

  loadOrder(orderId: string): void {
    // Use demo data for fast loading
    setTimeout(() => {
      this.order = {
        id: orderId,
        orderNumber: 'ORD-2024-' + orderId.slice(-6).toUpperCase(),
        projectName: 'Standard Report - 123 Main Street',
        projectAddress: '123 Main Street, City, State 12345',
        structureType: 'residential',
        primaryPitch: '6/12',
        reportType: { id: 'standard', name: 'Standard Report', price: 25.00 },
        addons: [
          { id: 'addon_1', name: 'Gutter Measurements', price: 10.00 },
          { id: 'addon_3', name: 'Satellite Imagery', price: 20.00 }
        ],
        basePrice: 25.00,
        addonsTotal: 30.00,
        totalPrice: 55.00,
        status: 'pending',
        priority: 'medium',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        specialInstructions: 'Please include detailed measurements for the garage roof section.',
        createdAt: new Date(),
        statusTimeline: [
          {
            status: 'pending',
            changedAt: new Date(),
            changedByEmail: 'john@example.com',
            notes: 'Order created'
          }
        ]
      };
      this.loading = false;
    }, 300);
  }

  goBack(): void {
    this.router.navigate(['/dashboard/customer/orders']);
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
