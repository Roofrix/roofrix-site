import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
}

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './products.html',
  styleUrl: './products.scss',
})
export class Products {
  private router = inject(Router);

  products: Product[] = [
    {
      id: 'standard-report',
      name: 'Standard Roof Report',
      description: 'Comprehensive roof measurement report with accurate dimensions and area calculations.',
      price: 25.00
    },
    {
      id: 'premium-report',
      name: 'Premium Roof Report',
      description: 'Detailed roof analysis including 3D modeling, material estimates, and pitch calculations.',
      price: 45.00
    }
  ];

  selectProduct(product: Product): void {
    // Store selected product and navigate to new-order page
    sessionStorage.setItem('selectedProduct', JSON.stringify(product));
    this.router.navigate(['/dashboard/customer/new-order']);
  }
}
