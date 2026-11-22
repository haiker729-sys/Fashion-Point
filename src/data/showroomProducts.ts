import { PRODUCTS, type Product } from './catalog';

export type GarmentArchetype =
  | 'shirt'
  | 'saree'
  | 'coat'
  | 'blazer'
  | 'kurti'
  | 'kids-jacket'
  | 'jeans'
  | 'tshirt'
  | 'sherwani';

export interface ShowroomProduct extends Product {
  modelRef: GarmentArchetype;
  has3DModel: boolean;
  isDemoData: boolean;
  sectionId: string;
  garmentScale: number;
}

const MODEL_MAP: Record<string, { modelRef: GarmentArchetype; sectionId: string; scale: number }> = {
  'prod-1': { modelRef: 'shirt', sectionId: 'men', scale: 1.0 },
  'prod-2': { modelRef: 'saree', sectionId: 'traditional', scale: 1.08 },
  'prod-3': { modelRef: 'coat', sectionId: 'women', scale: 1.05 },
  'prod-4': { modelRef: 'blazer', sectionId: 'men', scale: 1.02 },
  'prod-5': { modelRef: 'kurti', sectionId: 'traditional', scale: 1.0 },
  'prod-6': { modelRef: 'kids-jacket', sectionId: 'kids', scale: 0.78 },
  'prod-7': { modelRef: 'jeans', sectionId: 'discount-zone', scale: 0.96 },
  'prod-8': { modelRef: 'tshirt', sectionId: 'best-sellers', scale: 0.96 },
  'prod-9': { modelRef: 'sherwani', sectionId: 'new-arrivals', scale: 1.05 },
};

/**
 * Temporary Phase 3 local demo products mapped to procedural 3D garment models.
 * Structured so Phase 4 can swap in the live catalog without changing 3D slot bindings.
 */
export const SHOWROOM_PRODUCTS: ShowroomProduct[] = PRODUCTS.map((product) => {
  const meta = MODEL_MAP[product.id] || {
    modelRef: 'shirt' as GarmentArchetype,
    sectionId: 'new-arrivals',
    scale: 1,
  };
  return {
    ...product,
    modelRef: meta.modelRef,
    has3DModel: true,
    isDemoData: true,
    sectionId: meta.sectionId,
    garmentScale: meta.scale,
  };
});

export function getShowroomProductById(productId: string): ShowroomProduct | undefined {
  return SHOWROOM_PRODUCTS.find((p) => p.id === productId);
}
