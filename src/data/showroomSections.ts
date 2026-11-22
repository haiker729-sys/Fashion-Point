export type ShowroomSectionId =
  | 'new-arrivals'
  | 'men'
  | 'women'
  | 'kids'
  | 'traditional'
  | 'best-sellers'
  | 'discount-zone'
  | 'checkout-info';

export interface ShowroomSection {
  id: ShowroomSectionId;
  name: string;
  shortName: string;
  tagline: string;
  cameraPos: [number, number, number];
  lookAt: [number, number, number];
  highlightRackIds: string[];
  mapX: number; // 0..100 percentage on mini-map
  mapY: number; // 0..100 percentage on mini-map
  accentColor: string;
}

export const SHOWROOM_ENTRANCE_CAMERA = {
  outsidePos: [0, 2.3, 18.2] as [number, number, number],
  outsideLookAt: [0, 2.0, 4.0] as [number, number, number],
  insidePos: [0, 1.78, 8.6] as [number, number, number],
  insideLookAt: [0, 1.65, -1.5] as [number, number, number],
};

export const SHOWROOM_SECTIONS: ShowroomSection[] = [
  {
    id: 'new-arrivals',
    name: 'New Arrivals Atrium',
    shortName: 'New Arrivals',
    tagline: 'Central illuminated podium showcasing hero couture silhouettes',
    cameraPos: [0, 1.85, 6.2],
    lookAt: [0, 1.45, 0],
    highlightRackIds: ['rack-new-arrivals'],
    mapX: 50,
    mapY: 50,
    accentColor: '#FF7A00',
  },
  {
    id: 'men',
    name: "Men's Section",
    shortName: 'Men',
    tagline: 'Tailored Italian blazers, linen shirts & Japanese selvedge denim',
    cameraPos: [-4.2, 1.78, 1.2],
    lookAt: [-10.6, 1.45, 0.2],
    highlightRackIds: ['rack-men-1', 'rack-men-2'],
    mapX: 16,
    mapY: 50,
    accentColor: '#FFA94D',
  },
  {
    id: 'women',
    name: "Women's Section",
    shortName: 'Women',
    tagline: 'Cashmere-wool trench coats & sculpted atelier outerwear',
    cameraPos: [4.2, 1.78, 1.2],
    lookAt: [10.6, 1.45, 0.2],
    highlightRackIds: ['rack-women-1', 'rack-women-2'],
    mapX: 84,
    mapY: 50,
    accentColor: '#FF7A00',
  },
  {
    id: 'kids',
    name: 'Kids Section',
    shortName: 'Kids',
    tagline: 'Quilted bomber sets & everyday junior designer ensembles',
    cameraPos: [-4.4, 1.72, -4.5],
    lookAt: [-9.8, 1.25, -8.5],
    highlightRackIds: ['rack-kids-1'],
    mapX: 19,
    mapY: 22,
    accentColor: '#FFA94D',
  },
  {
    id: 'traditional',
    name: 'Traditional Wear',
    shortName: 'Traditional',
    tagline: 'Handwoven Banarasi zari silk sarees, artisan kurtis & bandhgala sherwanis',
    cameraPos: [0, 1.85, -4.6],
    lookAt: [0, 1.55, -10.8],
    highlightRackIds: ['rack-traditional-1'],
    mapX: 50,
    mapY: 16,
    accentColor: '#FF7A00',
  },
  {
    id: 'best-sellers',
    name: 'Best Sellers Gallery',
    shortName: 'Best Sellers',
    tagline: 'Most-coveted wardrobe icons curated from client favorites',
    cameraPos: [4.5, 1.78, 6.4],
    lookAt: [9.8, 1.45, 7.6],
    highlightRackIds: ['rack-bestsellers'],
    mapX: 82,
    mapY: 76,
    accentColor: '#16A34A',
  },
  {
    id: 'discount-zone',
    name: 'Discount Zone',
    shortName: 'Discount Zone',
    tagline: 'Festival privilege racks with 30% to 40% seasonal savings',
    cameraPos: [-4.5, 1.78, 6.4],
    lookAt: [-9.8, 1.45, 7.6],
    highlightRackIds: ['rack-sale-1'],
    mapX: 18,
    mapY: 76,
    accentColor: '#DC2626',
  },
  {
    id: 'checkout-info',
    name: 'Checkout Information Point',
    shortName: 'Checkout Info',
    tagline: 'Concierge desk, sizing guide & Phase 5 checkout preview point',
    cameraPos: [4.8, 1.78, -5.0],
    lookAt: [9.8, 1.35, -9.2],
    highlightRackIds: [],
    mapX: 82,
    mapY: 22,
    accentColor: '#2563EB',
  },
];

export function getShowroomSectionById(id: ShowroomSectionId): ShowroomSection {
  return SHOWROOM_SECTIONS.find((s) => s.id === id) || SHOWROOM_SECTIONS[0];
}
