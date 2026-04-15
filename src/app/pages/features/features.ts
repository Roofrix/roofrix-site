import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { take } from 'rxjs';

@Component({
  selector: 'app-features',
  imports: [],
  templateUrl: './features.html',
  styleUrl: './features.scss',
})
export class Features {
  private router = inject(Router);
  private authService = inject(AuthService);

  navigateToSignup(): void {
    this.authService.isAuthenticated$.pipe(take(1)).subscribe(isAuthenticated => {
      if (isAuthenticated) {
        this.router.navigate(['/dashboard/customer/new-order']);
      } else {
        this.router.navigate(['/signup']);
      }
    });
  }
}
