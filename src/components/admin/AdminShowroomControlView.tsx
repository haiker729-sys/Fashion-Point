import React, { useMemo, useState } from 'react';
import {
  Box,
  ExternalLink,
  Lightbulb,
  Loader2,
  Save,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCatalog, type ProductDraftInput } from '../../context/CatalogContext';
import {
  SHOWROOM_SECTIONS,
  type ShowroomSectionId,
} from '../../data/showroomSections';
import { saveShowroomSectionConfig } from '../../firebase/adminData';
import type { ShowroomSectionConfigDoc } from '../../firebase/firestore';
import { useRouter } from '../../router/RouterContext';
import { appendActivityLogApi } from '../../services/adminApi';
import type { ResolvedCatalogProduct } from '../../types/catalog';
import { useToast } from '../ui/Overlays';
import { Button, ProductBadge, ResilientImage, StatusAlert } from '../ui/Primitives';

interface AdminShowroomControlViewProps {
  showroomSections: ShowroomSectionConfigDoc[];
}

const MERCHANDISING_SECTIONS = SHOWROOM_SECTIONS.filter(
  (sec) => sec.id !== 'checkout-info'
);

const RACK_OPTIONS = [
  'rack-new-arrivals',
  'rack-men-1',
  'rack-men-2',
  'rack-women-1',
  'rack-women-2',
  'rack-kids-1',
  'rack-traditional-1',
  'rack-bestsellers',
  'rack-discount',
];

function toProductDraft(
  prod: ResolvedCatalogProduct,
  mappingPatch: Partial<ResolvedCatalogProduct['showroomMapping']>
): ProductDraftInput {
  return {
    name: prod.name,
    slug: prod.slug,
    sku: prod.sku,
    description: prod.description,
    categoryId: prod.categoryId,
    subcategoryId: prod.subcategoryId,
    brand: prod.brand,
    originalPrice: prod.originalPrice,
    sellingPrice: prod.sellingPrice,
    discountPercentage: prod.discountPercentage,
    salePrice: prod.salePrice,
    taxInfoPlaceholder: prod.taxInfoPlaceholder,
    images: prod.images,
    variants: prod.variants,
    tags: prod.tags,
    fabric: prod.fabric,
    weight: prod.weight,
    featured: prod.featured,
    bestSeller: prod.bestSeller,
    newArrival: prod.newArrival,
    trending: prod.trending,
    discountCollection: prod.discountCollection,
    status: prod.status,
    lowStockThreshold: prod.lowStockThreshold,
    rating: prod.rating,
    reviewCount: prod.reviewCount,
    showroomMapping: {
      ...prod.showroomMapping,
      ...mappingPatch,
    },
  };
}

export const AdminShowroomControlView: React.FC<AdminShowroomControlViewProps> = ({
  showroomSections,
}) => {
  const { navigate } = useRouter();
  const { user, hasPermission } = useAuth();
  const { products, updateProduct } = useCatalog();
  const { addToast } = useToast();

  const canManage = hasPermission('showroom:manage');

  const [savingZoneId, setSavingZoneId] = useState<string | null>(null);
  const [zoneDrafts, setZoneDrafts] = useState<
    Record<
      string,
      {
        lightingPreset: ShowroomSectionConfigDoc['lightingPreset'];
        active: boolean;
      }
    >
  >({});

  const sectionMap = useMemo(
    () => new Map(showroomSections.map((s) => [s.id, s])),
    [showroomSections]
  );

  const handleSaveZone = async (zone: (typeof MERCHANDISING_SECTIONS)[number]) => {
    if (!canManage) return;
    const existing = sectionMap.get(zone.id);
    const draft = zoneDrafts[zone.id];
    const lightingPreset =
      draft?.lightingPreset || existing?.lightingPreset || 'warm_luxury';
    const active = draft?.active ?? existing?.active ?? true;

    const assignedProductIds = products
      .filter(
        (p) =>
          p.showroomMapping.enabled &&
          p.showroomMapping.showroomSection === zone.id
      )
      .map((p) => p.id)
      .slice(0, 30);

    setSavingZoneId(zone.id);
    try {
      await saveShowroomSectionConfig(
        {
          id: zone.id,
          sectionId: zone.id,
          title: existing?.title || zone.name,
          lightingPreset,
          featuredProductIds: assignedProductIds,
          active,
        },
        Boolean(existing)
      );
      void appendActivityLogApi(user, {
        action: 'Showroom Updated',
        entityType: 'showroom',
        entityId: zone.id,
        summary: `Saved 3D Showroom zone ${zone.name} (lighting: ${lightingPreset}, active: ${active}, ${assignedProductIds.length} products)`,
      });
      addToast({
        type: 'success',
        title: '3D Showroom Zone Saved',
        description: `Updated ${zone.name} in Cloud Firestore.`,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Save Failed',
        description: err instanceof Error ? err.message : 'Unable to save showroom zone.',
      });
    } finally {
      setSavingZoneId(null);
    }
  };

  const handleUpdateProductMapping = (
    productId: string,
    patch: Partial<ResolvedCatalogProduct['showroomMapping']>
  ) => {
    if (!canManage) return;
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    updateProduct(productId, toProductDraft(prod, patch));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#FF7A00]">
            Spatial Merchandising · Live Firestore Sync with 3D Walkthrough
          </p>
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-[#1F1D2B]">
            3D Showroom Control Center
          </h2>
          <p className="text-xs text-[#1F1D2B]/65 mt-0.5">
            Configure zone lighting presets, toggle 3D sections, and assign products to exact racks
            and display slots across the virtual mall.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<ExternalLink className="h-3.5 w-3.5" />}
          onClick={() => navigate('/showroom')}
        >
          Launch Live 3D Showroom
        </Button>
      </div>

      {!canManage && (
        <StatusAlert
          variant="info"
          title="Read-Only 3D Showroom Preview"
          description="Manager, Admin, and Super Admin roles can modify 3D showroom zones and product rack placements."
        />
      )}

      {/* Showroom Architectural Zones */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {MERCHANDISING_SECTIONS.map((zone) => {
          const existing = sectionMap.get(zone.id);
          const draft = zoneDrafts[zone.id];
          const lighting =
            draft?.lightingPreset || existing?.lightingPreset || 'warm_luxury';
          const isActive = draft?.active ?? existing?.active ?? true;
          const zoneProducts = products.filter(
            (p) =>
              p.showroomMapping.enabled &&
              p.showroomMapping.showroomSection === zone.id
          );

          return (
            <div
              key={zone.id}
              className="rounded-2xl border border-[#1F1D2B]/12 bg-white p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold text-[#FF7A00] flex items-center gap-1">
                      <Box className="h-3.5 w-3.5" />
                      {zone.shortName}
                    </p>
                    <h3 className="font-heading text-base font-bold text-[#1F1D2B]">
                      {zone.name}
                    </h3>
                  </div>
                  <ProductBadge tone={isActive ? 'success' : 'surface'}>
                    {isActive ? 'VISIBLE' : 'HIDDEN'}
                  </ProductBadge>
                </div>

                <div className="space-y-1.5 text-xs">
                  <label className="font-semibold text-[#1F1D2B] flex items-center gap-1">
                    <Lightbulb className="h-3.5 w-3.5 text-[#F59E0B]" />
                    Lighting Preset
                  </label>
                  <select
                    disabled={!canManage}
                    value={lighting}
                    onChange={(e) =>
                      setZoneDrafts((prev) => ({
                        ...prev,
                        [zone.id]: {
                          lightingPreset: e.target.value as ShowroomSectionConfigDoc['lightingPreset'],
                          active: isActive,
                        },
                      }))
                    }
                    className="w-full h-9 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3 text-xs font-semibold disabled:opacity-60"
                  >
                    <option value="warm_luxury">Warm Luxury (Gold Rings)</option>
                    <option value="daylight_atelier">Daylight Atelier (4000K)</option>
                    <option value="evening_gala">Evening Gala Spotlight</option>
                  </select>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-[#1F1D2B]/65 tabular-nums">
                    Assigned Products: <strong>{zoneProducts.length}</strong>
                  </span>
                  {canManage && (
                    <label className="inline-flex items-center gap-1.5 font-semibold text-[#1F1D2B] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) =>
                          setZoneDrafts((prev) => ({
                            ...prev,
                            [zone.id]: {
                              lightingPreset: lighting,
                              active: e.target.checked,
                            },
                          }))
                        }
                        className="h-4 w-4 accent-[#FF7A00]"
                      />
                      Active Zone
                    </label>
                  )}
                </div>
              </div>

              {canManage && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  fullWidth
                  disabled={savingZoneId === zone.id}
                  leftIcon={
                    savingZoneId === zone.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )
                  }
                  onClick={() => void handleSaveZone(zone)}
                >
                  {savingZoneId === zone.id ? 'Syncing...' : 'Save Zone to Firestore'}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Product-to-Rack Placement Matrix */}
      <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1F1D2B]/10 flex items-center justify-between">
          <div>
            <h3 className="font-heading text-sm font-bold text-[#1F1D2B] flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-[#FF7A00]" />
              Product 3D Rack &amp; Display Placement ({products.length} Products)
            </h3>
            <p className="text-xs text-[#1F1D2B]/60">
              Toggle 3D visibility or assign products to showroom sections, racks, and display slots
              in real time.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#1F1D2B]/10 bg-[#FFF8EF]/70 text-[#1F1D2B]/60">
                <th className="py-3 px-4 font-semibold">Product</th>
                <th className="py-3 px-4 font-semibold">Show in 3D</th>
                <th className="py-3 px-4 font-semibold">Showroom Section</th>
                <th className="py-3 px-4 font-semibold">Rack ID</th>
                <th className="py-3 px-4 font-semibold">Slot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F1D2B]/8">
              {products.map((prod) => (
                <tr key={prod.id} className="hover:bg-[#FFF8EF]/45">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg overflow-hidden border border-[#1F1D2B]/10 shrink-0">
                        <ResilientImage
                          src={prod.mainImage}
                          alt={prod.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-[#1F1D2B] truncate max-w-[240px]">
                          {prod.name}
                        </p>
                        <p className="font-mono text-[10px] text-[#1F1D2B]/55">{prod.sku}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!canManage}
                        checked={prod.showroomMapping.enabled}
                        onChange={(e) =>
                          handleUpdateProductMapping(prod.id, { enabled: e.target.checked })
                        }
                        className="h-4 w-4 accent-[#FF7A00]"
                      />
                      {prod.showroomMapping.enabled ? 'Enabled' : 'Hidden'}
                    </label>
                  </td>
                  <td className="py-3 px-4">
                    <select
                      disabled={!canManage}
                      value={prod.showroomMapping.showroomSection}
                      onChange={(e) =>
                        handleUpdateProductMapping(prod.id, {
                          showroomSection: e.target.value as ShowroomSectionId,
                        })
                      }
                      className="h-8 rounded-lg border border-[#1F1D2B]/15 bg-white px-2 text-xs font-semibold disabled:opacity-60"
                    >
                      {MERCHANDISING_SECTIONS.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <select
                      disabled={!canManage}
                      value={prod.showroomMapping.rackId}
                      onChange={(e) =>
                        handleUpdateProductMapping(prod.id, {
                          rackId: e.target.value,
                        })
                      }
                      className="h-8 rounded-lg border border-[#1F1D2B]/15 bg-white px-2 text-xs font-mono disabled:opacity-60"
                    >
                      {RACK_OPTIONS.map((rack) => (
                        <option key={rack} value={rack}>
                          {rack}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <select
                      disabled={!canManage}
                      value={prod.showroomMapping.displaySlot}
                      onChange={(e) =>
                        handleUpdateProductMapping(prod.id, {
                          displaySlot: Number(e.target.value),
                        })
                      }
                      className="h-8 rounded-lg border border-[#1F1D2B]/15 bg-white px-2 text-xs font-mono disabled:opacity-60"
                    >
                      {[0, 1, 2].map((slot) => (
                        <option key={slot} value={slot}>
                          Slot {slot + 1}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
