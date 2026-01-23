import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { take } from 'rxjs';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit, OnDestroy {
  private router = inject(Router);
  private authService = inject(AuthService);

  currentSlide = 0;
  previousSlide = -1;
  totalSlides = 4;
  private autoSlideInterval: any;

  // Report images
  reportImages = [
    { src: 'assets/website/Home Page/01.png', alt: 'Report Preview 1' },
    { src: 'assets/website/Home Page/02.png', alt: 'Report Preview 2' },
    { src: 'assets/website/Home Page/03.png', alt: 'Report Preview 3' },
    { src: 'assets/website/Home Page/04.png', alt: 'Report Preview 4' }
  ];

  // Services
  services = [
    {
      icon: 'assets/website/Home Page/roof.png',
      title: 'Roof Sketches & Reports',
      description: 'Accurate roof measurements for insurance claims and contractors'
    },
    {
      icon: 'assets/website/Home Page/wall.png',
      title: 'Wall Sketches & Reports',
      description: 'Detailed wall measurements for precise estimations'
    },
    {
      icon: 'assets/website/Home Page/fence and deck.png',
      title: 'Fence & Deck Reports',
      description: 'Complete fence and deck measurements and reports'
    }
  ];

  ngOnInit(): void {
    this.startAutoSlide();
  }

  ngOnDestroy(): void {
    this.stopAutoSlide();
  }

  startAutoSlide(): void {
    this.autoSlideInterval = setInterval(() => {
      this.nextSlide();
    }, 4000);
  }

  stopAutoSlide(): void {
    if (this.autoSlideInterval) {
      clearInterval(this.autoSlideInterval);
    }
  }

  goToSlide(index: number): void {
    this.previousSlide = this.currentSlide;
    this.currentSlide = index;
    this.stopAutoSlide();
    this.startAutoSlide();
  }

  nextSlide(): void {
    this.previousSlide = this.currentSlide;
    this.currentSlide = (this.currentSlide + 1) % this.totalSlides;
  }

  prevSlide(): void {
    this.previousSlide = this.currentSlide;
    this.currentSlide = (this.currentSlide - 1 + this.totalSlides) % this.totalSlides;
  }

  isActiveSlide(index: number): boolean {
    return this.currentSlide === index;
  }

  isPrevSlide(index: number): boolean {
    return this.previousSlide === index;
  }

  scrollToHowItWorks(): void {
    const element = document.getElementById('how-it-works');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  orderNow(): void {
    this.authService.isAuthenticated$.pipe(take(1)).subscribe(isAuthenticated => {
      if (isAuthenticated) {
        // User is logged in - go to new order with basic structure type
        sessionStorage.setItem('selectedStructureType', 'basic');
        this.router.navigate(['/dashboard/customer/new-order'], {
          queryParams: { type: 'basic', t: Date.now() }
        });
      } else {
        // User is not logged in - redirect to signin
        this.router.navigate(['/signin']);
      }
    });
  }
}
