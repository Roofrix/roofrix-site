import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { OrderService, OrderReportType, OrderAddon } from '../../../../core/services/order.service';
import { CartService } from '../../../../core/services/cart.service';
import { Subscription, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
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
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './new-order.html',
  styleUrl: './new-order.scss',
})
export class NewOrder implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapElement') mapElement!: ElementRef;
  @ViewChild('addressInput') addressInput!: ElementRef;

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private orderService = inject(OrderService);
  private cartService = inject(CartService);
  private pricingService = inject(PricingService);
  private router = inject(Router);
  private ngZone = inject(NgZone);

  private routeSubscription?: Subscription;
  private searchSubscription?: Subscription;
  private activatedRoute = inject(ActivatedRoute);

  // Debounced address search
  private searchSubject = new Subject<string>();
  searchingAddress = false;

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
  fileError = '';

  // Inline validation errors (non-form-control fields)
  locationError = '';
  reportTypeError = '';
  structureTypeError = '';

  // Flag to skip search after paste (geocode handles it)
  private isPasting = false;

  // Selected product from products page
  selectedProduct: any = null;

  ngOnInit(): void {
    // Initialize form first
    this.orderForm = this.fb.group({
      address: ['', [Validators.required]],
      reportType: ['', [Validators.required]],
      structureType: ['', [Validators.required]],
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

    // Clear inline errors in real time when user selects values
    this.orderForm.get('reportType')?.valueChanges.subscribe(() => {
      this.reportTypeError = '';
    });
    this.orderForm.get('structureType')?.valueChanges.subscribe(() => {
      this.structureTypeError = '';
    });

    // Set up debounced address search (300ms delay)
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      this.performAddressSearch(query);
    });
  }

  ngOnDestroy(): void {
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
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

      // Add satellite layer as default (ESRI - free)
      const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 19
      }).addTo(this.map);

      // Add street map as alternate option
      const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      });

      // Add layer control so user can switch
      const baseLayers = {
        'Satellite': satelliteLayer,
        'Street Map': streetLayer
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
          this.locationConfirmed = false;
          this.locationError = '';
          this.updateLocationFromCoords(position.lat, position.lng);
        });
      });

      // Map click event to place marker
      this.map.on('click', (e: any) => {
        this.ngZone.run(() => {
          this.locationConfirmed = false;
          this.locationError = '';
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
    if (this.isPasting) {
      this.searchingAddress = false;
      return;
    }
    const query = this.orderForm.get('address')?.value;
    if (!query || query.length < 3) {
      this.searchResults = [];
      this.showSearchResults = false;
      this.searchingAddress = false;
      return;
    }

    // Show loading state and emit to debounced subject
    this.searchingAddress = true;
    this.searchSubject.next(query);
  }

  private performAddressSearch(query: string): void {
    if (this.isPasting) {
      this.searchingAddress = false;
      return;
    }
    if (!query || query.length < 3) {
      this.searchResults = [];
      this.showSearchResults = false;
      this.searchingAddress = false;
      return;
    }

    this.fetchGeocode(query)
      .then(data => {
        this.ngZone.run(() => {
          this.searchResults = data || [];
          this.showSearchResults = this.searchResults.length > 0;
          this.searchingAddress = false;
        });
      })
      .catch(() => {
        this.ngZone.run(() => {
          this.searchResults = [];
          this.showSearchResults = false;
          this.searchingAddress = false;
        });
      });
  }

  selectSearchResult(result: any): void {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const address = result.display_name;

    // Update form
    this.orderForm.patchValue({ address });

    // Place marker and zoom in
    if (this.map && this.marker) {
      if (!this.map.hasLayer(this.marker)) {
        this.marker.addTo(this.map);
      }
      this.marker.setLatLng([lat, lng]);
      this.map.invalidateSize();
      this.map.flyTo([lat, lng], 18, { duration: 1.5 });
    }

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
      this.searchingAddress = false;
    }, 200);
  }

  onAddressPaste(event: ClipboardEvent): void {
    const pastedText = event.clipboardData?.getData('text')?.trim();
    console.log('[PASTE] Pasted text:', pastedText);
    if (!pastedText || pastedText.length < 3) {
      console.log('[PASTE] Text too short, skipping');
      return;
    }

    this.isPasting = true;
    this.searchingAddress = true;
    this.locationConfirmed = false;
    this.searchResults = [];
    this.showSearchResults = false;

    // Delay to let input value update and skip the (input) event
    setTimeout(() => {
      console.log('[PASTE] Starting geocode for:', pastedText);
      this.geocodeAndPlaceMarker(pastedText);
      // Keep isPasting true a bit longer to block any trailing (input) events
      setTimeout(() => { this.isPasting = false; }, 500);
    }, 300);
  }

  private geocodeAndPlaceMarker(query: string): void {
    console.log('[GEOCODE] Starting geocode for:', query);
    this.fetchGeocode(query)
      .then(data => {
        console.log('[GEOCODE] Results:', data);
        this.ngZone.run(() => {
          this.searchingAddress = false;
          this.searchResults = [];
          this.showSearchResults = false;

          if (data && data.length > 0) {
            const result = data[0];
            const lat = parseFloat(result.lat);
            const lng = parseFloat(result.lon);
            // Keep the user's original pasted text in the input
            const address = this.orderForm.get('address')?.value || result.display_name;
            console.log('[GEOCODE] Found location:', { lat, lng, address });

            // Place marker and zoom
            console.log('[GEOCODE] Map exists:', !!this.map, 'Marker exists:', !!this.marker);
            if (this.map && this.marker) {
              if (!this.map.hasLayer(this.marker)) {
                this.marker.addTo(this.map);
              }
              this.marker.setLatLng([lat, lng]);
              this.map.invalidateSize();
              this.map.flyTo([lat, lng], 18, { duration: 1.5 });
              console.log('[GEOCODE] Marker placed and map flying to location');
            }

            this.selectedLocation = { lat, lng, address };
          } else {
            console.log('[GEOCODE] No results found for query');
          }
        });
      })
      .catch((err) => {
        console.error('[GEOCODE] Failed:', err);
        this.ngZone.run(() => {
          this.searchingAddress = false;
        });
      });
  }

  private fetchGeocode(query: string): Promise<any[]> {
    // Use Photon (Komoot) - handles abbreviations and worldwide addresses better
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`;
    console.log('[GEOCODE] Fetching Photon:', photonUrl);

    return fetch(photonUrl, {
      headers: { 'Accept': 'application/json' }
    })
      .then(response => {
        if (!response.ok) throw new Error(`Photon HTTP ${response.status}`);
        return response.json();
      })
      .then(geojson => {
        // Convert Photon GeoJSON to Nominatim-like format
        if (geojson.features && geojson.features.length > 0) {
          return geojson.features.map((f: any) => {
            const props = f.properties || {};
            const coords = f.geometry?.coordinates || [];
            // Build full address from all available parts
            const streetPart = [props.housenumber, props.street].filter(Boolean).join(' ');
            const parts = [streetPart, props.city, props.county, props.state, props.postcode, props.country].filter(Boolean);
            return {
              lat: String(coords[1]),
              lon: String(coords[0]),
              display_name: parts.join(', ') || props.name || query
            };
          });
        }
        return [];
      })
      .catch(err => {
        console.warn('[GEOCODE] Photon failed, falling back to Nominatim:', err);
        // Fallback to Nominatim
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
        return fetch(nominatimUrl, { headers: { 'Accept': 'application/json' } })
          .then(r => r.json());
      });
  }

  onAddressInput(event: Event): void {
    // Reset location confirmation when user types
    this.locationConfirmed = false;
  }

  confirmLocation(): void {
    if (this.selectedLocation) {
      this.locationConfirmed = true;
      this.locationError = '';
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
    this.fileError = '';
    if (input.files) {
      const files = Array.from(input.files);
      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      const maxSizeMB = 10;

      for (const file of files) {
        if (!allowedTypes.includes(file.type)) {
          this.fileError = `"${file.name}" is not a supported file type. Use JPG, PNG, or PDF.`;
          input.value = '';
          return;
        }
        if (file.size > maxSizeMB * 1024 * 1024) {
          this.fileError = `"${file.name}" exceeds the ${maxSizeMB}MB size limit.`;
          input.value = '';
          return;
        }
      }

      this.selectedFiles = files;
    }
  }

  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
  }

  onSubmit(): void {
    // Clear previous errors
    this.errorMessage = '';
    this.locationError = '';
    this.reportTypeError = '';
    this.structureTypeError = '';
    this.fileError = '';

    this.markFormGroupTouched(this.orderForm);

    let hasError = false;
    let firstErrorSection = '';

    // Validate address + location
    if (this.orderForm.get('address')?.invalid) {
      if (!firstErrorSection) firstErrorSection = 'address';
      hasError = true;
    }

    // Validate location confirmed
    if (!this.locationConfirmed) {
      this.locationError = 'Please confirm the pin location on the map';
      if (!firstErrorSection) firstErrorSection = 'address';
      hasError = true;
    }

    // Validate report type
    if (this.orderForm.get('reportType')?.invalid) {
      this.reportTypeError = 'Please select a report type';
      if (!firstErrorSection) firstErrorSection = 'reportType';
      hasError = true;
    }

    // Validate structure type
    if (this.orderForm.get('structureType')?.invalid) {
      this.structureTypeError = 'Please select a structure type';
      if (!firstErrorSection) firstErrorSection = 'structureType';
      hasError = true;
    }

    // Validate files if provided
    if (this.fileError) {
      if (!firstErrorSection) firstErrorSection = 'photos';
      hasError = true;
    }

    if (hasError) {
      // Expand and scroll to first error section
      if (firstErrorSection) {
        this.expandedSections[firstErrorSection] = true;
        setTimeout(() => {
          const sectionEl = document.querySelector(`.accordion-section.${firstErrorSection}-section`) ||
            document.querySelector(`[data-section="${firstErrorSection}"]`);
          if (sectionEl) {
            sectionEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
      return;
    }

    const selectedReportType = this.getSelectedReportType();

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
    // Clear previous errors
    this.errorMessage = '';
    this.locationError = '';
    this.reportTypeError = '';
    this.structureTypeError = '';
    this.fileError = '';

    this.markFormGroupTouched(this.orderForm);

    let hasError = false;
    let firstErrorSection = '';

    if (this.orderForm.get('address')?.invalid) {
      if (!firstErrorSection) firstErrorSection = 'address';
      hasError = true;
    }

    if (!this.locationConfirmed) {
      this.locationError = 'Please confirm the pin location on the map';
      if (!firstErrorSection) firstErrorSection = 'address';
      hasError = true;
    }

    if (this.orderForm.get('reportType')?.invalid) {
      this.reportTypeError = 'Please select a report type';
      if (!firstErrorSection) firstErrorSection = 'reportType';
      hasError = true;
    }

    if (this.orderForm.get('structureType')?.invalid) {
      this.structureTypeError = 'Please select a structure type';
      if (!firstErrorSection) firstErrorSection = 'structureType';
      hasError = true;
    }

    if (this.fileError) {
      if (!firstErrorSection) firstErrorSection = 'photos';
      hasError = true;
    }

    if (hasError) {
      if (firstErrorSection) {
        this.expandedSections[firstErrorSection] = true;
        setTimeout(() => {
          const sectionEl = document.querySelector(`.accordion-section.${firstErrorSection}-section`) ||
            document.querySelector(`[data-section="${firstErrorSection}"]`);
          if (sectionEl) {
            sectionEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
      return;
    }

    const selectedReportType = this.getSelectedReportType()!;

    // Build addons array
    const addonsArray: { id: string; name: string; price: number }[] = [];
    this.selectedAddons.forEach(addon => {
      addonsArray.push({
        id: addon.id,
        name: addon.name,
        price: addon.price
      });
    });

    // Generate project name from address
    const addressParts = this.selectedLocation!.address.split(',');
    const projectName = addressParts[0] || 'Rooftop Project';

    // Add to cart
    this.cartService.addToCart({
      projectName: projectName,
      projectAddress: this.selectedLocation!.address,
      location: { lat: this.selectedLocation!.lat, lng: this.selectedLocation!.lng, address: this.selectedLocation!.address },
      reportType: {
        id: selectedReportType.id,
        name: selectedReportType.name,
        description: selectedReportType.description,
        price: selectedReportType.price
      },
      selectedAddons: addonsArray,
      structureCategory: this.selectedStructureCategory,
      structureCategoryName: this.structureCategoryInfo?.name || this.selectedStructureCategory,
      structureCategorySqRange: this.structureCategoryInfo?.sqRange || '',
      specialInstructions: this.orderForm.get('specialInstructions')?.value || '',
      basePrice: this.getBasePrice(),
      addonsTotal: this.getAddonsTotal(),
      totalPrice: this.getTotalPrice()
    });

    // Show success message
    this.successMessage = 'Item added to cart successfully!';
    this.errorMessage = '';

    // Clear the success message after 3 seconds
    setTimeout(() => {
      this.successMessage = '';
    }, 3000);

    // Reset form for another item
    this.resetFormForNewItem();
  }

  private resetFormForNewItem(): void {
    // Reset location
    this.selectedLocation = null;
    this.locationConfirmed = false;
    this.locationError = '';
    this.reportTypeError = '';
    this.structureTypeError = '';
    this.fileError = '';

    // Clear marker from map
    if (this.map && this.marker && this.map.hasLayer(this.marker)) {
      this.map.removeLayer(this.marker);
    }

    // Reset form fields
    this.orderForm.patchValue({
      address: '',
      specialInstructions: ''
    });

    // Clear selected addons
    this.selectedAddons.clear();

    // Reset files
    this.selectedFiles = [];
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
      'reportType': 'Report type',
      'structureType': 'Structure type'
    };
    return labels[fieldName] || fieldName;
  }

  cancel(): void {
    this.router.navigate(['/dashboard/customer/orders']);
  }
}
