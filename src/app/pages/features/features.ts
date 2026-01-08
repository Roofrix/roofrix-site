import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-features',
  imports: [],
  templateUrl: './features.html',
  styleUrl: './features.scss',
})
export class Features {
  private router = inject(Router);

  navigateToSignup(): void {
    this.router.navigate(['/signup']);
  }
}
