import { Injectable, inject } from '@angular/core';
import { FirestoreService } from './firestore.service';

export type StructureCategoryId = 'basic' | 'moderate' | 'complex';

export interface StructureCategory {
  id: StructureCategoryId;
  name: string;
  description: string;
  sqRange: string;
  minSq: number;
  maxSq: number | null;
}

export interface ReportType {
  id: string;
  name: string;
  description: string;
  price: number;
}

export interface Addon {
  id: string;
  name: string;
  price: number;
  badge?: string;
}

export interface StructureType {
  id: string;
  name: string;
}

export interface StructureCategoryPricing {
  category: StructureCategory;
  reportTypes: ReportType[];
  addons: Addon[];
  structureTypes: StructureType[];
}

// Firestore only stores id + price
interface PriceEntry { id: string; price: number; }
interface FirestoreCategoryPricing {
  reportTypes: PriceEntry[];
  addons: PriceEntry[];
}

@Injectable({
  providedIn: 'root'
})
export class PricingService {
  private firestoreService = inject(FirestoreService);
  private prices: { [key in StructureCategoryId]?: FirestoreCategoryPricing } = {};
  private loaded = false;

  // Hardcoded: categories
  private readonly CATEGORIES: StructureCategory[] = [
    { id: 'basic', name: 'Basic Structure', description: 'Small residential properties', sqRange: '< 30 SQs', minSq: 0, maxSq: 30 },
    { id: 'moderate', name: 'Moderate Structure', description: 'Medium-sized residential properties', sqRange: '30 - 60 SQs', minSq: 30, maxSq: 60 },
    { id: 'complex', name: 'Complex / Commercial Structure', description: 'Large residential or commercial properties', sqRange: '> 60 SQs', minSq: 60, maxSq: null }
  ];

  // Hardcoded: report type definitions (same across all categories)
  private readonly REPORT_TYPES: Omit<ReportType, 'price'>[] = [
    { id: 'roof_esx_only', name: 'Roof ESX only', description: 'ESX format' },
    { id: 'roof_esx_pdf', name: 'Roof ESX+PDF', description: 'ESX with PDF report' },
    { id: 'roof_xml_only', name: 'Roof XML only', description: 'XML format' },
    { id: 'roof_xml_pdf', name: 'Roof XML+PDF', description: 'XML with PDF report' },
    { id: 'wall_esx_x1', name: 'Wall ESX only (X1)', description: 'Single wall ESX' },
    { id: 'wall_esx_pdf_x1', name: 'Wall ESX+PDF (X1)', description: 'Single wall ESX with PDF' },
    { id: 'wall_esx_x2', name: 'Wall ESX only (X2)', description: 'Double wall ESX' },
    { id: 'wall_esx_pdf_x2', name: 'Wall ESX+PDF (X2)', description: 'Double wall ESX with PDF' }
  ];

  // Hardcoded: addon definitions per category
  private readonly ADDONS: { [key in StructureCategoryId]: Omit<Addon, 'price'>[] } = {
    basic: [
      { id: 'basic_rush_2h', name: '2-Hour Rush', badge: 'URGENT' },
      { id: 'basic_fence', name: 'Fence' },
      { id: 'basic_deck', name: 'Deck' }
    ],
    moderate: [
      { id: 'moderate_rush_2h', name: '2-Hour Rush', badge: 'URGENT' },
      { id: 'moderate_fence', name: 'Fence' },
      { id: 'moderate_deck', name: 'Deck' }
    ],
    complex: [
      { id: 'complex_rush_2h', name: '2-Hour Rush', badge: 'URGENT' },
      { id: 'complex_fence', name: 'Fence' },
      { id: 'complex_deck', name: 'Deck' }
    ]
  };

  // Hardcoded: structure types
  private readonly STRUCTURE_TYPES: StructureType[] = [
    { id: 'main', name: 'Main' },
    { id: 'main_and_garage', name: 'Main and Garage' }
  ];

  /**
   * Load prices from Firestore (system/order).
   * Only id + price stored in DB; names/descriptions are hardcoded.
   */
  async loadPricing(): Promise<void> {
    if (this.loaded) return;

    try {
      const doc = await this.firestoreService.getDocument<any>('system', 'order');
      if (doc) {
        for (const key of ['basic', 'moderate', 'complex'] as StructureCategoryId[]) {
          if (doc[key]) {
            this.prices[key] = {
              reportTypes: doc[key].reportTypes || [],
              addons: doc[key].addons || []
            };
          }
        }
        this.loaded = true;
      }
    } catch (err) {
      console.error('Failed to load pricing from Firestore:', err);
    }
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  getStructureCategories(): StructureCategory[] {
    return this.CATEGORIES;
  }

  getStructureCategory(categoryId: StructureCategoryId): StructureCategory | undefined {
    return this.CATEGORIES.find(c => c.id === categoryId);
  }

  getPricingByCategory(categoryId: StructureCategoryId): StructureCategoryPricing | null {
    const category = this.getStructureCategory(categoryId);
    const priceData = this.prices[categoryId];
    if (!category || !priceData) return null;

    // Merge hardcoded definitions with Firestore prices
    const reportTypes: ReportType[] = this.REPORT_TYPES.map(rt => {
      const priceEntry = priceData.reportTypes.find(p => p.id === rt.id);
      return { ...rt, price: priceEntry?.price ?? 0 };
    });

    const addonDefs = this.ADDONS[categoryId] || [];
    const addons: Addon[] = addonDefs.map(addon => {
      const priceEntry = priceData.addons.find(p => p.id === addon.id);
      return { ...addon, price: priceEntry?.price ?? 0 };
    });

    return {
      category,
      reportTypes,
      addons,
      structureTypes: this.STRUCTURE_TYPES
    };
  }

  getCategoryDisplayName(categoryId: StructureCategoryId): string {
    return this.getStructureCategory(categoryId)?.name || categoryId;
  }
}
