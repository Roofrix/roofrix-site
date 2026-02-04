import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface CartItem {
  id: string;
  projectName: string;
  projectAddress: string;
  location: { lat: number; lng: number; address: string };
  reportType: { id: string; name: string; description: string; price: number };
  selectedAddons: { id: string; name: string; price: number }[];
  structureCategory: string;
  structureCategoryName: string;
  structureCategorySqRange: string;
  specialInstructions: string;
  basePrice: number;
  addonsTotal: number;
  totalPrice: number;
  addedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private cartItems: CartItem[] = [];
  private cartItemsSubject = new BehaviorSubject<CartItem[]>([]);
  private cartCountSubject = new BehaviorSubject<number>(0);

  cartItems$: Observable<CartItem[]> = this.cartItemsSubject.asObservable();
  cartCount$: Observable<number> = this.cartCountSubject.asObservable();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    const stored = sessionStorage.getItem('cartItems');
    if (stored) {
      try {
        this.cartItems = JSON.parse(stored);
        this.cartItemsSubject.next(this.cartItems);
        this.cartCountSubject.next(this.cartItems.length);
      } catch {
        this.cartItems = [];
      }
    }
  }

  private saveToStorage(): void {
    sessionStorage.setItem('cartItems', JSON.stringify(this.cartItems));
    this.cartItemsSubject.next(this.cartItems);
    this.cartCountSubject.next(this.cartItems.length);
  }

  addToCart(item: Omit<CartItem, 'id' | 'addedAt'>): void {
    const cartItem: CartItem = {
      ...item,
      id: this.generateId(),
      addedAt: new Date()
    };
    this.cartItems.push(cartItem);
    this.saveToStorage();
  }

  removeFromCart(itemId: string): void {
    this.cartItems = this.cartItems.filter(item => item.id !== itemId);
    this.saveToStorage();
  }

  updateCartItem(itemId: string, updates: Partial<CartItem>): void {
    const index = this.cartItems.findIndex(item => item.id === itemId);
    if (index !== -1) {
      this.cartItems[index] = { ...this.cartItems[index], ...updates };
      this.saveToStorage();
    }
  }

  getCartItems(): CartItem[] {
    return [...this.cartItems];
  }

  getCartCount(): number {
    return this.cartItems.length;
  }

  getCartTotal(): number {
    return this.cartItems.reduce((total, item) => total + item.totalPrice, 0);
  }

  clearCart(): void {
    this.cartItems = [];
    sessionStorage.removeItem('cartItems');
    this.cartItemsSubject.next([]);
    this.cartCountSubject.next(0);
  }

  isEmpty(): boolean {
    return this.cartItems.length === 0;
  }

  private generateId(): string {
    return 'cart_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}
