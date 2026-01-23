import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { OrderService, OrderReportType, OrderAddon } from '../../../../core/services/order.service';
import { Subscription } from 'rxjs';
import {
  PricingService,
  StructureCategory,
  StructureCategoryId,
  StructureCategoryPricing,
  ReportType as PricingReportType,
  Addon as PricingAddon
} from '../../../../core/services/pricing.service';

declare var L: any;

// Local interfaces
interface ReportType {
  id: string;
  name: string;
  description: string;
  price: number;
}

interface Addon {
  id: string;
  name: string;
  price: number;
  badge?: string;
}

interface SelectedLocation {
  lat: number;
  lng: number;
  address: string;
}

@Component({
  selector: 'app-new-order',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './new-order.html',
  styleUrl: './new-order.scss',
})
export class NewOrder implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapElement') mapElement!: ElementRef;
  @ViewChild('addressInput') addressInput!: ElementRef;

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private orderService = inject(OrderService);
  private pricingService = inject(PricingService);
  private router = inject(Router);
  private ngZone = inject(NgZone);

  private routeSubscription?: Subscription;
  private activatedRoute = inject(ActivatedRoute);

  orderForm!: FormGroup;
  loading = false;
  loadingPricing = false;
  errorMessage = '';
  successMessage = '';

  // Leaflet Maps
  map: any;
  marker: any;
  selectedLocation: SelectedLocation | null = null;
  locationConfirmed = false;
  searchResults: any[] = [];
  showSearchResults = false;

  // Accordion state
  expandedSections: { [key: string]: boolean } = {
    address: true,
    reportType: true,
    addons: true,
    structureType: true,
    roofPitch: true,
    instructions: true,
    photos: true
  };

  // Structure Category (from menu selection)
  selectedStructureCategory: StructureCategoryId = 'basic';
  structureCategoryInfo: StructureCategory | null = null;

  // Pricing data loaded based on structure category
  reportTypes: ReportType[] = [];
  addons: Addon[] = [];

  // Selected addons tracking
  selectedAddons: Map<string, Addon> = new Map();

  // File upload
  selectedFiles: File[] = [];

  // Selected product from products page
  selectedProduct: any = null;

  ngOnInit(): void {
    // Initialize form first
    this.orderForm = this.fb.group({
      address: ['', [Validators.required]],
      reportType: ['', [Validators.required]],
      structureType: ['main'],
      primaryPitch: [''],
      secondaryPitch: [''],
      specialInstructions: ['']
    });

    // Load structure category from sessionStorage (set by menu selection)
    this.loadStructureCategoryFromStorage();

    // Subscribe to query params to detect when structure type changes
    this.routeSubscription = this.activatedRoute.queryParams.subscribe(params => {
      if (params['type']) {
        this.loadStructureCategoryFromStorage();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
  }

  /**
   * Load structure category from sessionStorage and update pricing
   */
  private loadStructureCategoryFromStorage(): void {
    const storedCategory = sessionStorage.getItem('selectedStructureType');
    if (storedCategory && ['basic', 'moderate', 'complex'].includes(storedCategory)) {
      const newCategory = storedCategory as StructureCategoryId;
      // Only reload if category changed
      if (newCategory !== this.selectedStructureCategory || !this.structureCategoryInfo) {
        this.selectedStructureCategory = newCategory;
        this.loadPricingForCategory(this.selectedStructureCategory);
        // Reset selected addons when category changes
        this.selectedAddons.clear();
      }
    } else if (!this.structureCategoryInfo) {
      // Load default if no stored category and not already loaded
      this.loadPricingForCategory(this.selectedStructureCategory);
    }
  }

  /**
   * Load pricing data for the selected structure category
   */
  private loadPricingForCategory(categoryId: StructureCategoryId): void {
    const pricing = this.pricingService.getPricingByCategory(categoryId);

    if (pricing) {
      this.structureCategoryInfo = pricing.category;
      this.reportTypes = pricing.reportTypes.map(rt => ({
        id: rt.id,
        name: rt.name,
        description: rt.description,
        price: rt.price
      }));
      this.addons = pricing.addons.map(addon => ({
        id: addon.id,
        name: addon.name,
        price: addon.price,
        badge: addon.badge
      }));

      // Set default report type if form exists
      if (this.orderForm && this.reportTypes.length > 0) {
        this.orderForm.patchValue({ reportType: this.reportTypes[0].id });
      }
    }
  }

  ngAfterViewInit(): void {
    // Delay initialization to ensure DOM is ready
    setTimeout(() => {
      this.initLeafletMap();
    }, 100);
  }

  private initLeafletMap(): void {
    try {
      // Check if Leaflet is loaded
      if (typeof L === 'undefined') {
        console.warn('Leaflet not loaded. Map functionality will be limited.');
        return;
      }

      // Check if map element exists
      if (!this.mapElement?.nativeElement) {
        console.warn('Map element not found.');
        return;
      }

      // Default location (USA center)
      const defaultLocation: [number, number] = [39.8283, -98.5795];

      // Initialize map
      this.map = L.map(this.mapElement.nativeElement, {
        center: defaultLocation,
        zoom: 4,
        zoomControl: true
      });

      // Add OpenStreetMap tiles (free)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(this.map);

      // Add satellite layer option using ESRI (free)
      const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 19
      });

      // Add layer control
      const baseLayers = {
        'Street Map': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }),
        'Satellite': satelliteLayer
      };
      L.control.layers(baseLayers).addTo(this.map);

      // Create draggable marker (hidden initially)
      const customIcon = L.divIcon({
        className: 'custom-marker',
        html: '<div style="background:#ef4444;width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3);"></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 30]
      });

      this.marker = L.marker(defaultLocation, {
        icon: customIcon,
        draggable: true
      });

      // Marker drag event
      this.marker.on('dragend', () => {
        const position = this.marker.getLatLng();
        this.ngZone.run(() => {
          this.updateLocationFromCoords(position.lat, position.lng);
        });
      });

      // Map click event to place marker
      this.map.on('click', (e: any) => {
        this.ngZone.run(() => {
          const { lat, lng } = e.latlng;
          this.placeMarker(lat, lng);
          this.updateLocationFromCoords(lat, lng);
        });
      });

    } catch (error) {
      console.error('Error initializing Leaflet map:', error);
    }
  }

  private placeMarker(lat: number, lng: number): void {
    if (!this.map || !this.marker) return;

    // Add marker to map if not already added
    if (!this.map.hasLayer(this.marker)) {
      this.marker.addTo(this.map);
    }

    // Update marker position
    this.marker.setLatLng([lat, lng]);

    // Center map on marker
    this.map.setView([lat, lng], Math.max(this.map.getZoom(), 16));
  }

  private updateLocationFromCoords(lat: number, lng: number): void {
    // Reverse geocode using Nominatim (free)
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;

    fetch(url)
      .then(response => response.json())
      .then(data => {
        this.ngZone.run(() => {
          if (data && data.display_name) {
            const address = data.display_name;
            this.orderForm.patchValue({ address });
            this.selectedLocation = { lat, lng, address };
          } else {
            this.selectedLocation = { lat, lng, address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` };
          }
          this.locationConfirmed = false;
        });
      })
      .catch(() => {
        this.ngZone.run(() => {
          this.selectedLocation = { lat, lng, address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` };
          this.locationConfirmed = false;
        });
      });
  }

  searchAddress(): void {
    const query = this.orderForm.get('address')?.value;
    if (!query || query.length < 3) {
      this.searchResults = [];
      this.showSearchResults = false;
      return;
    }

    // Search using Nominatim (free)
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=us&limit=5`;

    fetch(url)
      .then(response => response.json())
      .then(data => {
        this.ngZone.run(() => {
          this.searchResults = data || [];
          this.showSearchResults = this.searchResults.length > 0;
        });
      })
      .catch(() => {
        this.ngZone.run(() => {
          this.searchResults = [];
          this.showSearchResults = false;
        });
      });
  }

  selectSearchResult(result: any): void {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const address = result.display_name;

    // Update form
    this.orderForm.patchValue({ address });

    // Place marker and center map
    this.placeMarker(lat, lng);
    this.map.setView([lat, lng], 18);

    // Store location
    this.selectedLocation = { lat, lng, address };
    this.locationConfirmed = false;

    // Hide search results
    this.searchResults = [];
    this.showSearchResults = false;
  }

  hideSearchResults(): void {
    setTimeout(() => {
      this.showSearchResults = false;
    }, 200);
  }

  onAddressInput(event: Event): void {
    // Reset location confirmation when user types
    this.locationConfirmed = false;
  }

  confirmLocation(): void {
    if (this.selectedLocation) {
      this.locationConfirmed = true;
    }
  }

  toggleSection(section: string): void {
    this.expandedSections[section] = !this.expandedSections[section];
  }

  toggleAddon(addon: Addon): void {
    if (this.selectedAddons.has(addon.id)) {
      this.selectedAddons.delete(addon.id);
    } else {
      this.selectedAddons.set(addon.id, addon);
    }
  }

  isAddonSelected(addonId: string): boolean {
    return this.selectedAddons.has(addonId);
  }

  getSelectedReportType(): ReportType | undefined {
    const selectedId = this.orderForm.get('reportType')?.value;
    return this.reportTypes.find(t => t.id === selectedId);
  }

  getBasePrice(): number {
    const selectedType = this.getSelectedReportType();
    return selectedType?.price || 0;
  }

  getAddonsTotal(): number {
    let total = 0;
    this.selectedAddons.forEach(addon => {
      total += addon.price;
    });
    return total;
  }

  getTotalPrice(): number {
    return this.getBasePrice() + this.getAddonsTotal();
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.selectedFiles = Array.from(input.files);
    }
  }

  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
  }

  onSubmit(): void {
    if (this.orderForm.invalid) {
      this.markFormGroupTouched(this.orderForm);
      return;
    }

    const selectedReportType = this.getSelectedReportType();
    if (!selectedReportType) {
      this.errorMessage = 'Please select a report type';
      return;
    }

    // Store order data for review page
    const formValue = this.orderForm.value;
    const addonsArray: any[] = [];
    this.selectedAddons.forEach(addon => {
      addonsArray.push({
        id: addon.id,
        name: addon.name,
        price: addon.price
      });
    });

    const orderData = {
      address: formValue.address,
      location: this.selectedLocation,
      latitude: this.selectedLocation?.lat || null,
      longitude: this.selectedLocation?.lng || null,
      reportType: selectedReportType,
      addons: addonsArray,
      // Structure category info
      structureCategory: this.selectedStructureCategory,
      structureCategoryName: this.structureCategoryInfo?.name || this.selectedStructureCategory,
      structureCategorySqRange: this.structureCategoryInfo?.sqRange || '',
      // Structure type (Main / Main and Garage)
      structureType: formValue.structureType,
      primaryPitch: formValue.primaryPitch,
      secondaryPitch: formValue.secondaryPitch,
      specialInstructions: formValue.specialInstructions,
      basePrice: this.getBasePrice(),
      addonsTotal: this.getAddonsTotal(),
      totalPrice: this.getTotalPrice()
    };

    sessionStorage.setItem('orderData', JSON.stringify(orderData));
    this.router.navigate(['/dashboard/customer/order-review']);
  }

  addToCart(): void {
    // For now, same as submit - can be extended for cart functionality later
    this.onSubmit();
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  hasError(fieldName: string, errorType: string): boolean {
    const field = this.orderForm.get(fieldName);
    return !!(field && field.hasError(errorType) && field.touched);
  }

  getErrorMessage(fieldName: string): string {
    const field = this.orderForm.get(fieldName);

    if (!field || !field.touched) {
      return '';
    }

    if (field.hasError('required')) {
      return `${this.getFieldLabel(fieldName)} is required`;
    }

    return '';
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      'address': 'Address',
      'reportType': 'Report type'
    };
    return labels[fieldName] || fieldName;
  }

  cancel(): void {
    this.router.navigate(['/dashboard/customer/orders']);
  }
}
