import type { Product, ProductColorOption, StockStatus } from '../data/catalog';
import type { GarmentArchetype } from '../data/showroomProducts';
import type { ShowroomSectionId } from '../data/showroomSections';

export type ImageViewType =
  | 'Front View'
  | 'Back View'
  | 'Side View'
  | 'Close-up View'
  | 'Lifestyle View';

export const IMAGE_VIEW_TYPES: ImageViewType[] = [
  'Front View',
  'Back View',
  'Side View',
  'Close-up View',
  'Lifestyle View',
];

export const STANDARD_CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;

export type ProductVisibilityStatus = 'published' | 'draft' | 'archived';

export interface ProductImageAsset {
  id: string;
  url: string;
  storagePath?: string;
  viewType: ImageViewType;
  isMain: boolean;
  order: number;
  alt: string;
  sizeKb?: number;
  compressed?: boolean;
}

export interface ProductVariant {
  id: string;
  colour: string;
  colourHex: string;
  size: string;
  sku: string;
  stockQuantity: number;
}

export interface ProductShowroomMapping {
  enabled: boolean;
  productId: string;
  modelUrlPlaceholder: string;
  modelArchetype: GarmentArchetype;
  has3DModel: boolean;
  showroomSection: ShowroomSectionId;
  rackId: string;
  displaySlot: number; // 0..2
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

export interface CatalogSubcategory {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  isCustom?: boolean;
}

export interface CatalogCategory {
  id: string;
  name: string;
  slug: string;
  departmentKey: 'Men' | 'Women' | 'Kids' | 'Traditional Wear' | 'Collections' | 'Custom';
  description: string;
  image: string;
  status?: ProductVisibilityStatus;
  sortOrder?: number;
  isCustom?: boolean;
  subcategories: CatalogSubcategory[];
}

export interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string;
  categoryId: string;
  subcategoryId: string;
  brand: string;
  originalPrice: number;
  sellingPrice: number;
  discountPercentage: number;
  salePrice?: number;
  taxInfoPlaceholder: string;
  images: ProductImageAsset[];
  variants: ProductVariant[];
  tags: string[];
  fabric: string;
  weight: string;
  featured: boolean;
  bestSeller: boolean;
  newArrival: boolean;
  trending: boolean;
  discountCollection: boolean;
  status: ProductVisibilityStatus;
  lowStockThreshold: number;
  rating: number;
  reviewCount: number;
  showroomMapping: ProductShowroomMapping;
  isDemoData: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Enriched product view that satisfies both Phase 4 CatalogProduct and Phase 1-3 Product contracts.
 */
export interface ResolvedCatalogProduct extends CatalogProduct {
  categoryName: string;
  subcategoryName: string;
  totalStock: number;
  stockStatus: StockStatus;
  mainImage: string;
  availableColors: ProductColorOption[];
  availableSizes: string[];
  legacyProduct: Product;
}
