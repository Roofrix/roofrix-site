import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
}

@Component({
  selector: 'app-product-order',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order.html',
  styleUrl: './order.scss',
})
export class ProductOrder implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  product: Product | null = null;
  quantity = 1;
  productId = '';

  ngOnInit(): void {
    this.productId = this.route.snapshot.paramMap.get('productId') || '';

    const stored = sessionStorage.getItem('selectedProduct');
    if (stored) {
      this.product = JSON.parse(stored);
    } else {
      // No product selected, redirect back
      this.router.navigate(['/dashboard/customer/orders/products']);
    }
  }

  increaseQuantity(): void {
    this.quantity++;
  }

  decreaseQuantity(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  getTotalPrice(): number {
    return this.product ? this.product.price * this.quantity : 0;
  }

  goBack(): void {
    this.router.navigate(['/dashboard/customer/orders/products']);
  }

  submitOrder(): void {
    // Store order details and navigate to review
    const orderData = {
      product: this.product,
      quantity: this.quantity,
      totalPrice: this.getTotalPrice()
    };
    sessionStorage.setItem('orderData', JSON.stringify(orderData));
    this.router.navigate(['/dashboard/customer/orders/products', this.productId, 'review']);
  }
}
