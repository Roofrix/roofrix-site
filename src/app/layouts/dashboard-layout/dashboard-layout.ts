import { Component, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { UserService, UserProfile } from '../../core/services/user.service';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.scss',
})
export class DashboardLayout {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private router = inject(Router);

  currentUser$ = this.authService.currentUser$;
  userProfile$: Observable<UserProfile | null> | null = null;
  showUserMenu = false;
  showOrderMenu = false;
  mobileMenuOpen = false;

  ngOnInit(): void {
    // Load user profile
    this.currentUser$.subscribe(user => {
      if (user?.uid) {
        this.userProfile$ = this.userService.userProfileListener(user.uid);
      }
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    // Check if click is outside menus
    if (!target.closest('.order-menu') && !target.closest('.user-menu')) {
      this.showOrderMenu = false;
      this.showUserMenu = false;
    }
  }

  toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.showUserMenu = !this.showUserMenu;
    this.showOrderMenu = false;
  }

  toggleOrderMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.showOrderMenu = !this.showOrderMenu;
    this.showUserMenu = false;
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
    this.showUserMenu = false;
    this.showOrderMenu = false;
  }

  signOut(): void {
    this.showUserMenu = false;
    this.showOrderMenu = false;
    this.mobileMenuOpen = false;
    this.authService.signOutUser().subscribe();
  }

  navigateToHome(): void {
    this.router.navigate(['/']);
  }

  navigateTo(path: string): void {
    this.showOrderMenu = false;
    this.mobileMenuOpen = false;
    this.router.navigate([path]);
  }

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
}
