import { Injectable, inject } from '@angular/core';
import { FirestoreService } from './firestore.service';
import { Observable } from 'rxjs';

/**
 * Structure Category - Basic, Moderate, Complex
 */
export type StructureCategoryId = 'basic' | 'moderate' | 'complex';

export interface StructureCategory {
  id: StructureCategoryId;
  name: string;
  description: string;
  sqRange: string;
  minSq: number;
  maxSq: number | null;
}

/**
 * Report Type with pricing per structure category
 */
export interface ReportType {
  id: string;
  name: string;
  description: string;
  price: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: any;
  updatedAt: any;
}

/**
 * Addon with pricing per structure category
 */
export interface Addon {
  id: string;
  name: string;
  price: number;
  badge?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: any;
  updatedAt: any;
}

/**
 * Structure Type for building type (residential, commercial, etc.)
 */
export interface StructureType {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

/**
 * Pricing configuration per structure category
 */
export interface StructureCategoryPricing {
  category: StructureCategory;
  reportTypes: ReportType[];
  addons: Addon[];
}

@Injectable({
  providedIn: 'root'
})
export class PricingService {
  private firestoreService = inject(FirestoreService);

  private readonly REPORT_TYPES_COLLECTION = 'reportTypes';
  private readonly ADDONS_COLLECTION = 'addons';
  private readonly STRUCTURE_TYPES_COLLECTION = 'structureTypes';

  /**
   * Structure Categories Definition
   */
  readonly STRUCTURE_CATEGORIES: StructureCategory[] = [
    {
      id: 'basic',
      name: 'Basic Structure',
      description: 'Small residential properties',
      sqRange: '< 30 SQs',
      minSq: 0,
      maxSq: 30
    },
    {
      id: 'moderate',
      name: 'Moderate Structure',
      description: 'Medium-sized residential properties',
      sqRange: '30 - 60 SQs',
      minSq: 30,
      maxSq: 60
    },
    {
      id: 'complex',
      name: 'Complex / Commercial Structure',
      description: 'Large residential or commercial properties',
      sqRange: '> 60 SQs',
      minSq: 60,
      maxSq: null
    }
  ];

  /**
   * Predefined pricing for each structure category
   * Report types are the same across all categories
   */
  private readonly CATEGORY_PRICING: { [key in StructureCategoryId]: { reportTypes: any[], addons: any[] } } = {
    basic: {
      reportTypes: [
        { id: 'roof_esx_only', name: 'Roof ESX only', description: 'ESX format', price: 14 },
        { id: 'roof_esx_pdf', name: 'Roof ESX+PDF', description: 'ESX with PDF report', price: 19 },
        { id: 'roof_xml_only', name: 'Roof XML only', description: 'XML format', price: 14 },
        { id: 'roof_xml_pdf', name: 'Roof XML+PDF', description: 'XML with PDF report', price: 19 },
        { id: 'wall_esx_x1', name: 'Wall ESX only (X1)', description: 'Single wall ESX', price: 33 },
        { id: 'wall_esx_pdf_x1', name: 'Wall ESX+PDF (X1)', description: 'Single wall ESX with PDF', price: 42 },
        { id: 'wall_esx_x2', name: 'Wall ESX only (X2)', description: 'Double wall ESX', price: 33 },
        { id: 'wall_esx_pdf_x2', name: 'Wall ESX+PDF (X2)', description: 'Double wall ESX with PDF', price: 42 }
      ],
      addons: [
        { id: 'basic_rush_2h', name: '2-Hour Rush', price: 20, badge: 'URGENT' },
        { id: 'basic_fence', name: 'Fence', price: 8 },
        { id: 'basic_deck', name: 'Deck', price: 8 }
      ]
    },
    moderate: {
      reportTypes: [
        { id: 'roof_esx_only', name: 'Roof ESX only', description: 'ESX format', price: 14 },
        { id: 'roof_esx_pdf', name: 'Roof ESX+PDF', description: 'ESX with PDF report', price: 19 },
        { id: 'roof_xml_only', name: 'Roof XML only', description: 'XML format', price: 14 },
        { id: 'roof_xml_pdf', name: 'Roof XML+PDF', description: 'XML with PDF report', price: 19 },
        { id: 'wall_esx_x1', name: 'Wall ESX only (X1)', description: 'Single wall ESX', price: 33 },
        { id: 'wall_esx_pdf_x1', name: 'Wall ESX+PDF (X1)', description: 'Single wall ESX with PDF', price: 42 },
        { id: 'wall_esx_x2', name: 'Wall ESX only (X2)', description: 'Double wall ESX', price: 33 },
        { id: 'wall_esx_pdf_x2', name: 'Wall ESX+PDF (X2)', description: 'Double wall ESX with PDF', price: 42 }
      ],
      addons: [
        { id: 'moderate_rush_2h', name: '2-Hour Rush', price: 30, badge: 'URGENT' },
        { id: 'moderate_fence', name: 'Fence', price: 12 },
        { id: 'moderate_deck', name: 'Deck', price: 12 }
      ]
    },
    complex: {
      reportTypes: [
        { id: 'roof_esx_only', name: 'Roof ESX only', description: 'ESX format', price: 14 },
        { id: 'roof_esx_pdf', name: 'Roof ESX+PDF', description: 'ESX with PDF report', price: 19 },
        { id: 'roof_xml_only', name: 'Roof XML only', description: 'XML format', price: 14 },
        { id: 'roof_xml_pdf', name: 'Roof XML+PDF', description: 'XML with PDF report', price: 19 },
        { id: 'wall_esx_x1', name: 'Wall ESX only (X1)', description: 'Single wall ESX', price: 33 },
        { id: 'wall_esx_pdf_x1', name: 'Wall ESX+PDF (X1)', description: 'Single wall ESX with PDF', price: 42 },
        { id: 'wall_esx_x2', name: 'Wall ESX only (X2)', description: 'Double wall ESX', price: 33 },
        { id: 'wall_esx_pdf_x2', name: 'Wall ESX+PDF (X2)', description: 'Double wall ESX with PDF', price: 42 }
      ],
      addons: [
        { id: 'complex_rush_2h', name: '2-Hour Rush', price: 50, badge: 'URGENT' },
        { id: 'complex_fence', name: 'Fence', price: 20 },
        { id: 'complex_deck', name: 'Deck', price: 20 }
      ]
    }
  };

  /**
   * Get all structure categories
   */
  getStructureCategories(): StructureCategory[] {
    return this.STRUCTURE_CATEGORIES;
  }

  /**
   * Get a specific structure category by ID
   */
  getStructureCategory(categoryId: StructureCategoryId): StructureCategory | undefined {
    return this.STRUCTURE_CATEGORIES.find(c => c.id === categoryId);
  }

  /**
   * Get pricing for a specific structure category
   */
  getPricingByCategory(categoryId: StructureCategoryId): StructureCategoryPricing | null {
    const category = this.getStructureCategory(categoryId);
    const pricing = this.CATEGORY_PRICING[categoryId];

    if (!category || !pricing) {
      return null;
    }

    return {
      category,
      reportTypes: pricing.reportTypes.map((rt, index) => ({
        ...rt,
        isActive: true,
        sortOrder: index + 1,
        createdAt: null,
        updatedAt: null
      })),
      addons: pricing.addons.map((addon, index) => ({
        ...addon,
        isActive: true,
        sortOrder: index + 1,
        createdAt: null,
        updatedAt: null
      }))
    };
  }

  /**
   * Get category name for display
   */
  getCategoryDisplayName(categoryId: StructureCategoryId): string {
    const category = this.getStructureCategory(categoryId);
    return category?.name || categoryId;
  }

  /**
   * Get all active report types (real-time listener)
   */
  getReportTypes(): Observable<ReportType[]> {
    const { where, orderBy } = this.firestoreService.getQueryHelpers();
    return this.firestoreService.collectionListener<ReportType>(
      this.REPORT_TYPES_COLLECTION,
      [where('isActive', '==', true), orderBy('sortOrder', 'asc')]
    );
  }

  /**
   * Get all active addons (real-time listener)
   */
  getAddons(): Observable<Addon[]> {
    const { where, orderBy } = this.firestoreService.getQueryHelpers();
    return this.firestoreService.collectionListener<Addon>(
      this.ADDONS_COLLECTION,
      [where('isActive', '==', true), orderBy('sortOrder', 'asc')]
    );
  }

  /**
   * Get all active structure types (real-time listener)
   */
  getStructureTypes(): Observable<StructureType[]> {
    const { where, orderBy } = this.firestoreService.getQueryHelpers();
    return this.firestoreService.collectionListener<StructureType>(
      this.STRUCTURE_TYPES_COLLECTION,
      [where('isActive', '==', true), orderBy('sortOrder', 'asc')]
    );
  }

  /**
   * Initialize default pricing data (Admin function - call once to seed database)
   */
  async initializeDefaultPricing(): Promise<void> {
    const timestamp = this.firestoreService.getTimestamp();

    // Default Report Types
    const defaultReportTypes: Omit<ReportType, 'id'>[] = [
      { name: 'Standard Roof Report', description: 'ESX only', price: 14, isActive: true, sortOrder: 1, createdAt: timestamp, updatedAt: timestamp },
      { name: 'Complex Roof Report', description: 'ESX only', price: 18, isActive: true, sortOrder: 2, createdAt: timestamp, updatedAt: timestamp },
      { name: 'Standard Roof Report', description: 'XML only', price: 14, isActive: true, sortOrder: 3, createdAt: timestamp, updatedAt: timestamp },
      { name: 'Complex Roof Report', description: 'XML only', price: 18, isActive: true, sortOrder: 4, createdAt: timestamp, updatedAt: timestamp }
    ];

    // Default Addons
    const defaultAddons: Omit<Addon, 'id'>[] = [
      { name: 'PDF', price: 5, isActive: true, sortOrder: 1, createdAt: timestamp, updatedAt: timestamp },
      { name: 'Fence', price: 5, isActive: true, sortOrder: 2, createdAt: timestamp, updatedAt: timestamp },
      { name: 'Deck', price: 5, isActive: true, sortOrder: 3, createdAt: timestamp, updatedAt: timestamp },
      { name: 'Make it 2hr Rush', price: 10, badge: 'FAST', isActive: true, sortOrder: 4, createdAt: timestamp, updatedAt: timestamp }
    ];

    // Default Structure Types
    const defaultStructureTypes: Omit<StructureType, 'id'>[] = [
      { name: 'Main', isActive: true, sortOrder: 1 },
      { name: 'Main and Garage', isActive: true, sortOrder: 2 }
    ];

    // Save Report Types
    for (let i = 0; i < defaultReportTypes.length; i++) {
      const id = `report_type_${i + 1}`;
      await this.firestoreService.setDocument(this.REPORT_TYPES_COLLECTION, id, defaultReportTypes[i]);
    }

    // Save Addons
    for (let i = 0; i < defaultAddons.length; i++) {
      const id = `addon_${i + 1}`;
      await this.firestoreService.setDocument(this.ADDONS_COLLECTION, id, defaultAddons[i]);
    }

    // Save Structure Types
    for (let i = 0; i < defaultStructureTypes.length; i++) {
      const id = `structure_type_${i + 1}`;
      await this.firestoreService.setDocument(this.STRUCTURE_TYPES_COLLECTION, id, defaultStructureTypes[i]);
    }

    console.log('Default pricing data initialized');
  }

  /**
   * Update report type price (Admin function)
   */
  async updateReportTypePrice(id: string, price: number): Promise<void> {
    const timestamp = this.firestoreService.getTimestamp();
    await this.firestoreService.updateDocument(this.REPORT_TYPES_COLLECTION, id, {
      price,
      updatedAt: timestamp
    });
  }

  /**
   * Update addon price (Admin function)
   */
  async updateAddonPrice(id: string, price: number): Promise<void> {
    const timestamp = this.firestoreService.getTimestamp();
    await this.firestoreService.updateDocument(this.ADDONS_COLLECTION, id, {
      price,
      updatedAt: timestamp
    });
  }

  /**
   * Add new report type (Admin function)
   */
  async addReportType(data: Omit<ReportType, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const timestamp = this.firestoreService.getTimestamp();
    const id = `report_type_${Date.now()}`;
    await this.firestoreService.setDocument(this.REPORT_TYPES_COLLECTION, id, {
      ...data,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    return id;
  }

  /**
   * Add new addon (Admin function)
   */
  async addAddon(data: Omit<Addon, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const timestamp = this.firestoreService.getTimestamp();
    const id = `addon_${Date.now()}`;
    await this.firestoreService.setDocument(this.ADDONS_COLLECTION, id, {
      ...data,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    return id;
  }
}
