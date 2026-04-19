import { Component, OnInit, OnDestroy, inject, HostListener, CUSTOM_ELEMENTS_SCHEMA, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { take } from 'rxjs';
import Swiper from 'swiper';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit, OnDestroy, AfterViewInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  @ViewChild('swiperContainer') swiperContainer!: ElementRef;
  private swiperInstance: Swiper | null = null;

  showOrderMenu = false;

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

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.initSwiper();
  }

  ngOnDestroy(): void {
    this.swiperInstance?.destroy();
  }

  private initSwiper(): void {
    this.swiperInstance = new Swiper(this.swiperContainer.nativeElement, {
      modules: [Navigation, Pagination, Autoplay],
      slidesPerView: 1,
      loop: true,
      autoplay: {
        delay: 3000,
        disableOnInteraction: false,
      },
      pagination: {
        el: '.swiper-pagination',
        clickable: true,
      },
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
    });
  }


  scrollToHowItWorks(): void {
    const element = document.getElementById('how-it-works');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.order-dropdown-wrapper')) {
      this.showOrderMenu = false;
    }
  }

  toggleOrderMenu(): void {
    this.showOrderMenu = !this.showOrderMenu;
  }

  selectStructure(structureType: string): void {
    this.showOrderMenu = false;
    this.authService.isAuthenticated$.pipe(take(1)).subscribe(isAuthenticated => {
      if (isAuthenticated) {
        sessionStorage.setItem('selectedStructureType', structureType);
        this.router.navigate(['/dashboard/customer/new-order'], {
          queryParams: { type: structureType, t: Date.now() }
        });
      } else {
        this.router.navigate(['/signin']);
      }
    });
  }
}
