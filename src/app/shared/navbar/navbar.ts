import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserService, UserProfile } from '../../core/services/user.service';
import { Observable } from 'rxjs';
import { User } from '../../core/models/user.interface';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.scss'],
})
export class Navbar {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private router = inject(Router);

  currentUser$: Observable<User | null> = this.authService.currentUser$;
  isAuthenticated$: Observable<boolean> = this.authService.isAuthenticated$;
  userProfile$: Observable<UserProfile | null> | null = null;
  showUserMenu = false;
  showOrderMenu = false;

  ngOnInit(): void {
    // Load user profile when authenticated
    this.currentUser$.subscribe(user => {
      if (user?.uid) {
        this.userProfile$ = this.userService.userProfileListener(user.uid);
      }
    });
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
   * Sign out the current user
   */
  signOut(): void {
    this.showUserMenu = false;
    this.showOrderMenu = false;
    this.authService.signOutUser().subscribe();
  }
}
