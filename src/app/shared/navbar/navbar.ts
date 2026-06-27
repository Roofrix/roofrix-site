import { Component, inject, ViewEncapsulation, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserService, UserProfile } from '../../core/services/user.service';
import { CartService } from '../../core/services/cart.service';
import { Observable, Subscription } from 'rxjs';
import { User } from '../../core/models/user.interface';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class Navbar implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private router = inject(Router);
  private cartService = inject(CartService);
  private authSub?: Subscription;

  currentUser$: Observable<User | null> = this.authService.currentUser$;
  isAuthenticated$: Observable<boolean> = this.authService.isAuthenticated$;
  userProfile$: Observable<UserProfile | null> | null = null;
  cartCount$ = this.cartService.cartCount$;
  showUserMenu = false;
  showOrderMenu = false;
  mobileMenuOpen = false;
  private currentProfileUid: string | null = null;

  ngOnInit(): void {
    this.authSub = this.currentUser$.subscribe(user => {
      if (user?.uid && user.uid !== this.currentProfileUid) {
        this.currentProfileUid = user.uid;
        this.userProfile$ = this.userService.userProfileListener(user.uid);
      } else if (!user) {
        this.currentProfileUid = null;
        this.userProfile$ = null;
      }
    });
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
  }

  /**
   * Navigate to signup page
   */
  navigateToSignup(): void {
    this.router.navigate(['/signup']);
  }

  /**
   * Navigate to signin page
   */
  navigateToSignin(): void {
    this.router.navigate(['/signin']);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.order-menu') && !target.closest('.user-menu')) {
      this.showOrderMenu = false;
      this.showUserMenu = false;
    }
  }

  /**
   * Toggle user menu dropdown
   */
  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
    this.showOrderMenu = false;
  }

  /**
   * Toggle order menu dropdown
   */
  toggleOrderMenu(): void {
    this.showOrderMenu = !this.showOrderMenu;
    this.showUserMenu = false;
  }

  /**
   * Navigate to a specific path
   */
  navigateTo(path: string): void {
    this.showOrderMenu = false;
    this.showUserMenu = false;
    this.router.navigate([path]);
  }

  /**
   * Select structure type and navigate to new-order
   */
  selectStructure(structureType: string): void {
    this.showOrderMenu = false;
    this.mobileMenuOpen = false;
    // Store the selected structure type and navigate to new-order with query param
    sessionStorage.setItem('selectedStructureType', structureType);
    // Use query param with timestamp to force route change detection
    this.router.navigate(['/dashboard/customer/new-order'], {
      queryParams: { type: structureType, t: Date.now() }
    });
  }

  /**
   * Toggle mobile menu
   */
  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
    this.showUserMenu = false;
    this.showOrderMenu = false;
  }

  /**
   * Sign out the current user
   */
  signOut(): void {
    this.showUserMenu = false;
    this.showOrderMenu = false;
    this.mobileMenuOpen = false;
    this.authService.signOutUser().subscribe();
  }

  /**
   * Navigate to cart page
   */
  navigateToCart(): void {
    this.mobileMenuOpen = false;
    this.router.navigate(['/dashboard/customer/cart']);
  }
}
