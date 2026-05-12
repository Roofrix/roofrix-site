import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CartService, CartItem } from '../../../../core/services/cart.service';
import { FileTransferService } from '../../../../core/services/file-transfer.service';
import { Observable } from 'rxjs';
import { FormatDatePipe } from '../../../../shared/pipes/format-date.pipe';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormatDatePipe],
  templateUrl: './cart.html',
  styleUrl: './cart.scss',
})
export class Cart implements OnInit {
  private router = inject(Router);
  private cartService = inject(CartService);
  private fileTransferService = inject(FileTransferService);

  cartItems$: Observable<CartItem[]> = this.cartService.cartItems$;

  ngOnInit(): void {}

  getCartTotal(): number {
    return this.cartService.getCartTotal();
  }

  getCartCount(): number {
    return this.cartService.getCartCount();
  }

  removeItem(itemId: string): void {
    this.cartService.removeFromCart(itemId);
    this.fileTransferService.removeCartItemFiles(itemId);
  }

  clearCart(): void {
    this.cartService.clearCart();
    this.fileTransferService.clear();
  }

  proceedToCheckout(): void {
    // Store cart items for order-review page
    const cartItems = this.cartService.getCartItems();
    if (cartItems.length === 0) {
      return;
    }

    // Store cart data for review page
    sessionStorage.setItem('cartCheckout', JSON.stringify({
      items: cartItems,
      totalPrice: this.getCartTotal()
    }));

    this.router.navigate(['/dashboard/customer/order-review'], {
      queryParams: { fromCart: true }
    });
  }

  getItemFiles(itemId: string): File[] {
    return this.fileTransferService.getCartItemFiles(itemId);
  }

  continueShopping(): void {
    this.router.navigate(['/dashboard/customer/new-order']);
  }

}
