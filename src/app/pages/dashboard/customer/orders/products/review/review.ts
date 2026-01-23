import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
}

interface OrderData {
  product: Product;
  quantity: number;
  totalPrice: number;
}

@Component({
  selector: 'app-order-review',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './review.html',
  styleUrl: './review.scss',
})
export class OrderReview implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  orderData: OrderData | null = null;
  productId = '';
  orderConfirmed = false;
  orderNumber = '';

  ngOnInit(): void {
    this.productId = this.route.snapshot.paramMap.get('productId') || '';

    const stored = sessionStorage.getItem('orderData');
    if (stored) {
      this.orderData = JSON.parse(stored);
    } else {
      // No order data, redirect back
      this.router.navigate(['/dashboard/customer/orders/products']);
    }
  }

  goBack(): void {
    this.router.navigate(['/dashboard/customer/orders/products', this.productId]);
  }

  confirmOrder(): void {
    // Generate order number
    this.orderNumber = 'ORD-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    this.orderConfirmed = true;

    // Clear session storage
    sessionStorage.removeItem('selectedProduct');
    sessionStorage.removeItem('orderData');
  }

  goToProducts(): void {
    this.router.navigate(['/dashboard/customer/orders/products']);
  }

  goToOrders(): void {
    this.router.navigate(['/dashboard/customer/orders']);
  }
}
