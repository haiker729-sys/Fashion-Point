import type { ShowroomSectionId } from './showroomSections';

export type RackType = 'wall-rail' | 'island-rack' | 'tiered-display';
export type SlotDisplayStatus = 'active' | 'empty' | 'reserved';

export interface ProductSlot {
  slotId: string;
  productId: string | null;
  position: [number, number, number]; // local to rack
  rotation: [number, number, number];
  scale: number;
  displayStatus: SlotDisplayStatus;
}

export interface ShowroomRack {
  rackId: string;
  sectionId: ShowroomSectionId;
  label: string;
  rackType: RackType;
  position: [number, number, number];
  rotation: [number, number, number];
  capacity: number;
  slots: ProductSlot[];
}

export interface MannequinConfig {
  id: string;
  label: string;
  sectionId: ShowroomSectionId;
  productId: string;
  position: [number, number, number];
  rotationY: number;
  heightScale: number;
  turntable: boolean;
  style: 'men' | 'women' | 'kids' | 'traditional';
}

export interface CollisionObstacle {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const SHOWROOM_BOUNDS = {
  minX: -12.6,
  maxX: 12.6,
  minZ: -12.4,
  maxZ: 12.6,
};

function createSlots(rackId: string, productIds: (string | null)[]): ProductSlot[] {
  const count = productIds.length;
  const span = 2.6;
  return productIds.map((pid, idx) => {
    const offset = count === 1 ? 0 : -span / 2 + (idx / (count - 1)) * span;
    return {
      slotId: `${rackId}-slot-${idx + 1}`,
      productId: pid,
      position: [offset, 1.72, 0],
      rotation: [0, 0, 0],
      scale: 1,
      displayStatus: pid ? 'active' : 'empty',
    };
  });
}

export const INITIAL_SHOWROOM_RACKS: ShowroomRack[] = [
  // West Wing — Men's Section
  {
    rackId: 'rack-men-1',
    sectionId: 'men',
    label: "Men's Tailored Shirts",
    rackType: 'wall-rail',
    position: [-11.4, 0, -1.6],
    rotation: [0, Math.PI / 2, 0],
    capacity: 3,
    slots: createSlots('rack-men-1', ['prod-1', 'prod-4', 'prod-7']),
  },
  {
    rackId: 'rack-men-2',
    sectionId: 'men',
    label: "Men's Suiting & Knitwear",
    rackType: 'island-rack',
    position: [-8.0, 0, 1.8],
    rotation: [0, Math.PI / 2, 0],
    capacity: 3,
    slots: createSlots('rack-men-2', ['prod-4', 'prod-8', 'prod-1']),
  },

  // East Wing — Women's Section
  {
    rackId: 'rack-women-1',
    sectionId: 'women',
    label: "Women's Luxury Outerwear",
    rackType: 'wall-rail',
    position: [11.4, 0, -1.6],
    rotation: [0, -Math.PI / 2, 0],
    capacity: 3,
    slots: createSlots('rack-women-1', ['prod-3', 'prod-5', 'prod-2']),
  },
  {
    rackId: 'rack-women-2',
    sectionId: 'women',
    label: "Women's Atelier Edit",
    rackType: 'island-rack',
    position: [8.0, 0, 1.8],
    rotation: [0, -Math.PI / 2, 0],
    capacity: 3,
    slots: createSlots('rack-women-2', ['prod-5', 'prod-3', 'prod-2']),
  },

  // North-West — Kids Section
  {
    rackId: 'rack-kids-1',
    sectionId: 'kids',
    label: 'Kids Boutique Rack',
    rackType: 'tiered-display',
    position: [-9.8, 0, -9.2],
    rotation: [0, Math.PI / 4, 0],
    capacity: 3,
    slots: createSlots('rack-kids-1', ['prod-6', 'prod-8', 'prod-6']),
  },

  // North — Traditional Wear Pavilion
  {
    rackId: 'rack-traditional-1',
    sectionId: 'traditional',
    label: 'Traditional Heritage Couture',
    rackType: 'wall-rail',
    position: [0, 0, -11.4],
    rotation: [0, 0, 0],
    capacity: 3,
    slots: createSlots('rack-traditional-1', ['prod-2', 'prod-9', 'prod-5']),
  },

  // South-West — Discount Zone
  {
    rackId: 'rack-sale-1',
    sectionId: 'discount-zone',
    label: 'Festival Sale · Up to 40% Off',
    rackType: 'island-rack',
    position: [-9.8, 0, 7.6],
    rotation: [0, -Math.PI / 4, 0],
    capacity: 3,
    slots: createSlots('rack-sale-1', ['prod-7', 'prod-1', 'prod-6']),
  },

  // South-East — Best Sellers
  {
    rackId: 'rack-bestsellers',
    sectionId: 'best-sellers',
    label: 'Best Sellers Display',
    rackType: 'island-rack',
    position: [9.8, 0, 7.6],
    rotation: [0, Math.PI / 4, 0],
    capacity: 3,
    slots: createSlots('rack-bestsellers', ['prod-8', 'prod-3', 'prod-4']),
  },

  // Central New Arrivals Feature Rack
  {
    rackId: 'rack-new-arrivals',
    sectionId: 'new-arrivals',
    label: 'New Arrivals Feature',
    rackType: 'tiered-display',
    position: [0, 0, -5.8],
    rotation: [0, 0, 0],
    capacity: 3,
    slots: createSlots('rack-new-arrivals', ['prod-9', 'prod-3', 'prod-1']),
  },
];

export const SHOWROOM_MANNEQUINS: MannequinConfig[] = [
  {
    id: 'mannequin-traditional',
    label: 'Royal Banarasi Saree',
    sectionId: 'new-arrivals',
    productId: 'prod-2',
    position: [0, 0, 0],
    rotationY: 0,
    heightScale: 1.0,
    turntable: true,
    style: 'traditional',
  },
  {
    id: 'mannequin-men',
    label: "Men's Italian Blazer",
    sectionId: 'men',
    productId: 'prod-4',
    position: [-1.45, 0, 0.55],
    rotationY: 0.35,
    heightScale: 1.06,
    turntable: false,
    style: 'men',
  },
  {
    id: 'mannequin-women',
    label: "Women's Cashmere Coat",
    sectionId: 'women',
    productId: 'prod-3',
    position: [1.45, 0, 0.55],
    rotationY: -0.35,
    heightScale: 0.98,
    turntable: false,
    style: 'women',
  },
  {
    id: 'mannequin-kids',
    label: 'Kids Amber Bomber',
    sectionId: 'kids',
    productId: 'prod-6',
    position: [-7.2, 0, -7.2],
    rotationY: 0.7,
    heightScale: 0.72,
    turntable: true,
    style: 'kids',
  },
];

/**
 * Axis-aligned collision boxes preventing users from walking through racks,
 * central mannequin podium, or the concierge desk.
 */
export const SHOWROOM_COLLIDERS: CollisionObstacle[] = [
  // Central Mannequin Podium
  { id: 'col-podium', minX: -2.6, maxX: 2.6, minZ: -2.4, maxZ: 2.4 },
  // Men's island rack
  { id: 'col-men-island', minX: -9.0, maxX: -7.0, minZ: -0.1, maxZ: 3.7 },
  // Women's island rack
  { id: 'col-women-island', minX: 7.0, maxX: 9.0, minZ: -0.1, maxZ: 3.7 },
  // New arrivals center rack
  { id: 'col-new-arrivals', minX: -2.1, maxX: 2.1, minZ: -6.7, maxZ: -4.9 },
  // Discount zone rack
  { id: 'col-sale', minX: -11.4, maxX: -8.2, minZ: 6.0, maxZ: 9.2 },
  // Best sellers rack
  { id: 'col-bestsellers', minX: 8.2, maxX: 11.4, minZ: 6.0, maxZ: 9.2 },
  // Kids display
  { id: 'col-kids', minX: -11.5, maxX: -8.0, minZ: -10.8, maxZ: -7.6 },
  // Checkout Information Desk (North-East)
  { id: 'col-checkout', minX: 7.6, maxX: 11.8, minZ: -11.0, maxZ: -7.6 },
];

/**
 * Reusable Phase 3 placement architecture helpers (ready for Phase 9 Admin Editor).
 */
export function getRackProductIds(rack: ShowroomRack): string[] {
  return rack.slots
    .filter((s) => s.displayStatus === 'active' && s.productId)
    .map((s) => s.productId as string);
}

export function placeProductOnRack(
  racks: ShowroomRack[],
  rackId: string,
  slotIndex: number,
  productId: string
): ShowroomRack[] {
  return racks.map((rack) => {
    if (rack.rackId !== rackId) return rack;
    const nextSlots = rack.slots.map((slot, idx) =>
      idx === slotIndex
        ? { ...slot, productId, displayStatus: 'active' as SlotDisplayStatus }
        : slot
    );
    return { ...rack, slots: nextSlots };
  });
}

export function removeProductFromRack(
  racks: ShowroomRack[],
  rackId: string,
  slotIndex: number
): ShowroomRack[] {
  return racks.map((rack) => {
    if (rack.rackId !== rackId) return rack;
    const nextSlots = rack.slots.map((slot, idx) =>
      idx === slotIndex
        ? { ...slot, productId: null, displayStatus: 'empty' as SlotDisplayStatus }
        : slot
    );
    return { ...rack, slots: nextSlots };
  });
}

/**
 * Resolves customer X/Z position against room walls and solid rack/podium obstacles.
 */
export function resolveShowroomCollision(x: number, z: number): [number, number] {
  let clampedX = Math.max(SHOWROOM_BOUNDS.minX, Math.min(SHOWROOM_BOUNDS.maxX, x));
  let clampedZ = Math.max(SHOWROOM_BOUNDS.minZ, Math.min(SHOWROOM_BOUNDS.maxZ, z));

  for (const box of SHOWROOM_COLLIDERS) {
    if (
      clampedX > box.minX &&
      clampedX < box.maxX &&
      clampedZ > box.minZ &&
      clampedZ < box.maxZ
    ) {
      const distLeft = Math.abs(clampedX - box.minX);
      const distRight = Math.abs(box.maxX - clampedX);
      const distTop = Math.abs(clampedZ - box.minZ);
      const distBottom = Math.abs(box.maxZ - clampedZ);
      const minDist = Math.min(distLeft, distRight, distTop, distBottom);

      if (minDist === distLeft) clampedX = box.minX;
      else if (minDist === distRight) clampedX = box.maxX;
      else if (minDist === distTop) clampedZ = box.minZ;
      else clampedZ = box.maxZ;
    }
  }

  return [clampedX, clampedZ];
}
