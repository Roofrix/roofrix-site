import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, NgZone, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { OrderService, OrderReportType, OrderAddon } from '../../../../core/services/order.service';
import { CartService } from '../../../../core/services/cart.service';
import { FileTransferService } from '../../../../core/services/file-transfer.service';
import { Subscription } from 'rxjs';
import {
  PricingService,
  StructureCategory,
  StructureCategoryId,
  StructureCategoryPricing,
  ReportType as PricingReportType,
  Addon as PricingAddon,
  StructureType
} from '../../../../core/services/pricing.service';

declare var google: any;

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
  private fileTransferService = inject(FileTransferService);

  private routeSubscription?: Subscription;
  private activatedRoute = inject(ActivatedRoute);

  searchingAddress = signal(false);

  orderForm!: FormGroup;
  loading = false;
  loadingPricing = false;
  errorMessage = '';
  successMessage = '';

  // Google Maps
  map: any;
  marker: any;
  geocoder: any;
  autocomplete: any;
  selectedLocation: SelectedLocation | null = null;
  locationConfirmed = false;

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
  structureTypes: StructureType[] = [];

  // Selected addons tracking
  selectedAddons: Map<string, Addon> = new Map();

  // File upload
  selectedFiles: File[] = [];
  fileError = '';

  // Inline validation errors (non-form-control fields)
  locationError = '';
  reportTypeError = '';
  structureTypeError = '';


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

  }

  ngOnDestroy(): void {
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
  }

  /**
   * Load structure category from sessionStorage and update pricing
   */
  private restoreOrderData(): void {
    const saved = sessionStorage.getItem('orderData');
    if (!saved) return;

    try {
      const data = JSON.parse(saved);

      // Restore form fields
      this.orderForm.patchValue({
        address: data.address || '',
        reportType: data.reportType?.id || '',
        structureType: data.structureType || '',
        primaryPitch: data.primaryPitch || '',
        secondaryPitch: data.secondaryPitch || '',
        specialInstructions: data.specialInstructions || ''
      });

      // Restore location and map pin
      if (data.location) {
        this.selectedLocation = data.location;
        this.locationConfirmed = true;
        // Place marker after map initializes
        setTimeout(() => {
          if (this.map && data.location.lat && data.location.lng) {
            this.placeMarker(data.location.lat, data.location.lng);
          }
        }, 500);
      }

      // Restore selected addons
      if (data.addons && Array.isArray(data.addons)) {
        this.selectedAddons.clear();
        for (const addon of data.addons) {
          this.selectedAddons.set(addon.id, addon);
        }
      }

      // Restore files from FileTransferService (in-memory, survives navigation)
      const savedFiles = this.fileTransferService.getFiles();
      if (savedFiles.length > 0) {
        this.selectedFiles = savedFiles;
      }
    } catch {
      // Invalid data, ignore
    }
  }

  private async loadStructureCategoryFromStorage(): Promise<void> {
    const storedCategory = sessionStorage.getItem('selectedStructureType');
    if (storedCategory && ['basic', 'moderate', 'complex'].includes(storedCategory)) {
      const newCategory = storedCategory as StructureCategoryId;
      // Only reload if category changed
      if (newCategory !== this.selectedStructureCategory || !this.structureCategoryInfo) {
        this.selectedStructureCategory = newCategory;
        await this.loadPricingForCategory(this.selectedStructureCategory);
        // Reset selected addons when category changes
        this.selectedAddons.clear();
      }
    } else if (!this.structureCategoryInfo) {
      // Load default if no stored category and not already loaded
      await this.loadPricingForCategory(this.selectedStructureCategory);
    }
  }

  /**
   * Load pricing data for the selected structure category
   */
  private async loadPricingForCategory(categoryId: StructureCategoryId): Promise<void> {
    if (!this.pricingService.isLoaded()) {
      await this.pricingService.loadPricing();
    }
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
      this.structureTypes = pricing.structureTypes;

      // Restore saved data or set default report type
      if (this.orderForm) {
        const hasSavedData = sessionStorage.getItem('orderData');
        if (hasSavedData) {
          this.restoreOrderData();
        } else if (this.reportTypes.length > 0) {
          this.orderForm.patchValue({ reportType: this.reportTypes[0].id });
        }
      }
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initGoogleMap();
    }, 100);
  }

  private initGoogleMap(): void {
    try {
      if (typeof google === 'undefined' || !google.maps) {
        console.warn('Google Maps not loaded.');
        return;
      }

      if (!this.mapElement?.nativeElement) {
        console.warn('Map element not found.');
        return;
      }

      // Default location (USA center)
      const defaultCenter = { lat: 39.8283, lng: -98.5795 };

      // Initialize map with satellite view
      this.map = new google.maps.Map(this.mapElement.nativeElement, {
        center: defaultCenter,
        zoom: 4,
        mapTypeId: google.maps.MapTypeId.HYBRID,
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: google.maps.MapTypeControlStyle.DEFAULT,
          mapTypeIds: [google.maps.MapTypeId.HYBRID, google.maps.MapTypeId.ROADMAP]
        },
        zoomControl: true,
        streetViewControl: false,
        fullscreenControl: false
      });

      // Initialize geocoder
      this.geocoder = new google.maps.Geocoder();

      // Map click event to place marker
      this.map.addListener('click', (e: any) => {
        this.ngZone.run(() => {
          this.locationConfirmed = false;
          this.locationError = '';
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          this.placeMarker(lat, lng);
          this.reverseGeocode(lat, lng);
        });
      });

      // Initialize Places Autocomplete
      this.initAutocomplete();

    } catch (error) {
      console.error('Error initializing Google Map:', error);
    }
  }

  private placeMarker(lat: number, lng: number): void {
    if (!this.map) return;

    const position = { lat, lng };

    if (this.marker) {
      this.marker.setPosition(position);
    } else {
      this.marker = new google.maps.Marker({
        position,
        map: this.map,
        draggable: true
      });

      // Marker drag event
      this.marker.addListener('dragend', () => {
        const pos = this.marker.getPosition();
        this.ngZone.run(() => {
          this.locationConfirmed = false;
          this.locationError = '';
          this.reverseGeocode(pos.lat(), pos.lng());
        });
      });
    }

    this.map.panTo(position);
    if (this.map.getZoom() < 16) {
      this.map.setZoom(18);
    }
  }

  private reverseGeocode(lat: number, lng: number): void {
    if (!this.geocoder) return;

    this.geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
      this.ngZone.run(() => {
        if (status === 'OK' && results && results[0]) {
          const address = results[0].formatted_address;
          this.orderForm.patchValue({ address });
          this.selectedLocation = { lat, lng, address };
        } else {
          this.selectedLocation = { lat, lng, address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` };
        }
        this.locationConfirmed = false;
      });
    });
  }

  private initAutocomplete(): void {
    if (!this.addressInput?.nativeElement || typeof google === 'undefined') return;

    this.autocomplete = new google.maps.places.Autocomplete(this.addressInput.nativeElement, {
      types: ['address']
    });

    this.autocomplete.addListener('place_changed', () => {
      this.ngZone.run(() => {
        const place = this.autocomplete.getPlace();
        if (!place.geometry || !place.geometry.location) return;

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const address = place.formatted_address || this.addressInput.nativeElement.value;

        this.orderForm.patchValue({ address });
        this.placeMarker(lat, lng);
        this.map.setZoom(18);
        this.selectedLocation = { lat, lng, address };
        this.locationConfirmed = false;
        setTimeout(() => { this.searchingAddress.set(false); });
      });
    });

    // Keep Angular form control in sync with native input changes from autocomplete
    this.addressInput.nativeElement.addEventListener('input', () => {
      setTimeout(() => {
        this.ngZone.run(() => {
          this.orderForm.patchValue({ address: this.addressInput.nativeElement.value });
          this.locationConfirmed = false;
        });
      });
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
    console.log('[NEW-ORDER] onSubmit called');
    console.log('[NEW-ORDER] Form valid:', this.orderForm.valid);
    console.log('[NEW-ORDER] Location confirmed:', this.locationConfirmed);
    console.log('[NEW-ORDER] Selected files:', this.selectedFiles.length);
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
    console.log('[NEW-ORDER] Files to transfer:', this.selectedFiles.length, this.selectedFiles);
    this.fileTransferService.setFiles(this.selectedFiles);
    console.log('[NEW-ORDER] Files in service after set:', this.fileTransferService.getFiles().length);
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
    const cartItemId = this.cartService.addToCart({
      projectName: projectName,
      projectAddress: this.selectedLocation!.address,
      location: { lat: this.selectedLocation!.lat, lng: this.selectedLocation!.lng },
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

    // Store files for this cart item
    if (this.selectedFiles.length > 0) {
      this.fileTransferService.addCartItemFiles(cartItemId, this.selectedFiles);
    }

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
    if (this.marker) {
      this.marker.setMap(null);
      this.marker = null;
    }

    // Reset all form fields
    this.orderForm.patchValue({
      address: '',
      reportType: '',
      structureType: '',
      primaryPitch: '',
      secondaryPitch: '',
      specialInstructions: ''
    });
    this.orderForm.markAsUntouched();
    this.orderForm.markAsPristine();

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
