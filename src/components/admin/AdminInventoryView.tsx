import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownUp,
  CheckCircle2,
  History,
  Layers,
  Loader2,
  PackageX,
  Palette,
  Ruler,
  Sliders,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCatalog } from '../../context/CatalogContext';
import { useToast } from '../ui/Overlays';
import { adjustInventoryStockApi } from '../../services/adminApi';
import type { InventoryMovementDoc } from '../../types/admin';
import type { ProductVariant, ResolvedCatalogProduct } from '../../types/catalog';
import { formatINR } from '../../utils/catalogHelpers';
import { Button, ProductBadge, ResilientImage, SearchBar, StatusAlert } from '../ui/Primitives';

interface AdminInventoryViewProps {
  initialTab?: 'stock' | 'variants' | 'breakdown' | 'history';
  movements?: InventoryMovementDoc[];
  onEditProduct: (productId: string) => void;
}

export const AdminInventoryView: React.FC<AdminInventoryViewProps> = ({
  initialTab = 'stock',
  movements = [],
  onEditProduct,
}) => {
  const { user, hasPermission } = useAuth();
  const { addToast } = useToast();
  const { products, lowStockThreshold, setLowStockThreshold, monitor } = useCatalog();
  const [activeTab, setActiveTab] = useState<'stock' | 'variants' | 'breakdown' | 'history'>(
    initialTab
  );
  const [query, setQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>(
    'all'
  );

  // Transactional Stock Adjustment Drawer State
  const [adjustTarget, setAdjustTarget] = useState<{
    product: ResolvedCatalogProduct;
    variant: ProductVariant;
  } | null>(null);
  const [adjustMode, setAdjustMode] = useState<'delta' | 'set'>('delta');
  const [adjustValue, setAdjustValue] = useState('10');
  const [movementType, setMovementType] =
    useState<InventoryMovementDoc['movementType']>('restock');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustBusy, setAdjustBusy] = useState(false);

  const canUpdateStock = hasPermission('inventory:update');
  const canManageProducts = hasPermission('products:manage');

  const summary = useMemo(() => {
    let totalUnits = 0;
    let totalVariants = 0;
    let lowStockProducts = 0;
    let outOfStockProducts = 0;
    let inventoryValue = 0;

    const bySize = new Map<string, number>();
    const byColour = new Map<string, { hex: string; units: number }>();

    for (const p of products) {
      totalUnits += p.totalStock;
      totalVariants += p.variants.length;
      inventoryValue += p.totalStock * p.sellingPrice;
      if (p.stockStatus === 'low_stock') lowStockProducts += 1;
      if (p.stockStatus === 'out_of_stock') outOfStockProducts += 1;

      for (const v of p.variants) {
        bySize.set(v.size, (bySize.get(v.size) || 0) + v.stockQuantity);
        const existingCol = byColour.get(v.colour) || { hex: v.colourHex, units: 0 };
        existingCol.units += v.stockQuantity;
        byColour.set(v.colour, existingCol);
      }
    }

    return {
      totalUnits,
      totalVariants,
      lowStockProducts,
      outOfStockProducts,
      inventoryValue,
      sizeBreakdown: Array.from(bySize.entries())
        .map(([size, units]) => ({ size, units }))
        .sort((a, b) => b.units - a.units),
      colourBreakdown: Array.from(byColour.entries())
        .map(([colour, info]) => ({ colour, hex: info.hex, units: info.units }))
        .sort((a, b) => b.units - a.units),
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const matchesStatus = stockFilter === 'all' || p.stockStatus === stockFilter;
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.variants.some((v) => v.sku.toLowerCase().includes(q) || v.colour.toLowerCase().includes(q));
      return matchesStatus && matchesQuery;
    });
  }, [products, query, stockFilter]);

  const filteredMovements = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return movements;
    return movements.filter(
      (m) =>
        m.productName.toLowerCase().includes(q) ||
        m.variantSku.toLowerCase().includes(q) ||
        m.reason.toLowerCase().includes(q) ||
        m.actorName.toLowerCase().includes(q)
    );
  }, [movements, query]);

  const openAdjustDialog = (product: ResolvedCatalogProduct, variant: ProductVariant) => {
    setAdjustTarget({ product, variant });
    setAdjustMode('delta');
    setAdjustValue('5');
    setMovementType('restock');
    setAdjustReason('');
  };

  const handleConfirmStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget || adjustBusy) return;
    const numericVal = Number(adjustValue);
    if (!Number.isInteger(numericVal)) {
      addToast({
        type: 'error',
        title: 'Invalid Quantity',
        description: 'Enter a whole integer quantity.',
      });
      return;
    }
    if (adjustReason.trim().length < 3) {
      addToast({
        type: 'error',
        title: 'Reason Required',
        description: 'Provide a clear stock movement reason (at least 3 characters).',
      });
      return;
    }

    setAdjustBusy(true);
    try {
      const res = await adjustInventoryStockApi(user, {
        productId: adjustTarget.product.id,
        variantId: adjustTarget.variant.id,
        mode: adjustMode,
        value: numericVal,
        movementType,
        reason: adjustReason.trim(),
      });
      addToast({
        type: 'success',
        title: 'Stock Adjusted Transactionally',
        description: `${adjustTarget.variant.sku}: ${res.previousStock} → ${res.newStock} units (${res.movementId})`,
      });
      setAdjustTarget(null);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Stock Adjustment Rejected',
        description: err instanceof Error ? err.message : 'Unable to commit stock update.',
      });
    } finally {
      setAdjustBusy(false);
    }
  };

  const movementLabel = (t: InventoryMovementDoc['movementType']) => {
    switch (t) {
      case 'restock':
        return 'Restock';
      case 'damage':
        return 'Damage / Shrinkage';
      case 'order_deduction':
        return 'Order Deduction';
      case 'return_restock':
        return 'Customer Return';
      default:
        return 'Manual Adjustment';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & View Switcher */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#FF7A00]">
            Real-Time Inventory Control · Transactional &amp; Concurrency-Safe
          </p>
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-[#1F1D2B]">
            Inventory Management &amp; Stock Ledger
          </h2>
          <p className="text-xs text-[#1F1D2B]/65 mt-0.5">
            Track size-wise &amp; colour-wise stock, enforce non-negative quantities, and audit every
            immutable stock movement record.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {hasPermission('settings:manage') && (
            <div className="flex items-center gap-2 rounded-xl border border-[#1F1D2B]/12 bg-white px-3 py-2 text-xs">
              <Sliders className="h-3.5 w-3.5 text-[#FF7A00]" />
              <label htmlFor="global-low-stock-threshold" className="font-semibold text-[#1F1D2B]">
                Low-Stock Threshold:
              </label>
              <input
                id="global-low-stock-threshold"
                type="number"
                min={1}
                max={200}
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                className="w-16 rounded-lg border border-[#1F1D2B]/15 bg-[#FFF8EF] px-2 py-1 text-center font-mono font-bold text-[#1F1D2B] focus:border-[#FF7A00] focus:outline-none"
              />
            </div>
          )}

          <div className="inline-flex flex-wrap rounded-xl border border-[#1F1D2B]/12 bg-white p-1">
            {[
              { id: 'stock', label: 'Stock Overview' },
              { id: 'variants', label: `Adjust Variants (${summary.totalVariants})` },
              { id: 'breakdown', label: 'Size & Colour' },
              { id: 'history', label: `History (${movements.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[#1F1D2B] text-[#FFF8EF]'
                    : 'text-[#1F1D2B]/70 hover:text-[#1F1D2B]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Inventory KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-[#1F1D2B]/60">Total Available Stock</p>
            <p className="mt-1 font-heading text-2xl font-bold text-[#1F1D2B] tabular-nums">
              {summary.totalUnits.toLocaleString('en-IN')} units
            </p>
            <p className="text-[11px] text-[#16A34A] font-medium mt-0.5 tabular-nums">
              Value: {formatINR(summary.inventoryValue)}
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#16A34A]/12 text-[#16A34A]">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-[#1F1D2B]/60">Active Variant SKUs</p>
            <p className="mt-1 font-heading text-2xl font-bold text-[#1F1D2B] tabular-nums">
              {summary.totalVariants}
            </p>
            <p className="text-[11px] text-[#1F1D2B]/55 mt-0.5">Colour × Size combinations</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB]/12 text-[#2563EB]">
            <Layers className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-[#1F1D2B]/60">Low Stock Products</p>
            <p className="mt-1 font-heading text-2xl font-bold text-[#F59E0B] tabular-nums">
              {summary.lowStockProducts}
            </p>
            <p className="text-[11px] text-[#1F1D2B]/55 mt-0.5">Threshold ≤ {lowStockThreshold}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F59E0B]/15 text-[#F59E0B]">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-[#1F1D2B]/60">Out of Stock Products</p>
            <p className="mt-1 font-heading text-2xl font-bold text-[#DC2626] tabular-nums">
              {summary.outOfStockProducts}
            </p>
            <p className="text-[11px] text-[#1F1D2B]/55 mt-0.5">Requires immediate restock</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DC2626]/12 text-[#DC2626]">
            <PackageX className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="w-full sm:w-80">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder={
              activeTab === 'history'
                ? 'Search movement SKU, product, reason, actor...'
                : 'Search product, SKU, or colour...'
            }
          />
        </div>
        {activeTab !== 'history' && activeTab !== 'breakdown' && (
          <div className="flex items-center gap-1.5 overflow-x-auto fw-no-scrollbar">
            {[
              { id: 'all', label: 'All Stock' },
              { id: 'in_stock', label: 'In Stock' },
              { id: 'low_stock', label: 'Low Stock' },
              { id: 'out_of_stock', label: 'Out of Stock' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStockFilter(f.id as typeof stockFilter)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap cursor-pointer ${
                  stockFilter === f.id
                    ? 'bg-[#1F1D2B] text-[#FFF8EF]'
                    : 'bg-white border border-[#1F1D2B]/12 text-[#1F1D2B]/75 hover:border-[#FF7A00]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tab Views */}
      {activeTab === 'stock' ? (
        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#1F1D2B]/10 bg-[#FFF8EF]/70 text-xs text-[#1F1D2B]/60">
                  <th className="py-3 px-4 font-semibold">Product</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold text-right">Variants</th>
                  <th className="py-3 px-4 font-semibold text-right">Threshold</th>
                  <th className="py-3 px-4 font-semibold text-right">Total Stock</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F1D2B]/8">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-[#FFF8EF]/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3 min-w-[200px]">
                        <ResilientImage
                          src={p.mainImage}
                          alt={p.name}
                          className="h-11 w-9 rounded-lg object-cover bg-[#FFF8EF] shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-[#1F1D2B] truncate">{p.name}</p>
                          <p className="text-[11px] font-mono text-[#1F1D2B]/55">{p.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#1F1D2B]/75 whitespace-nowrap">
                      {p.categoryName} · {p.subcategoryName}
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-semibold tabular-nums">
                      {p.variants.length}
                    </td>
                    <td className="py-3 px-4 text-right text-xs text-[#1F1D2B]/65 tabular-nums">
                      ≤ {p.lowStockThreshold || lowStockThreshold}
                    </td>
                    <td className="py-3 px-4 text-right font-heading font-bold text-[#1F1D2B] tabular-nums">
                      {p.totalStock}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {p.stockStatus === 'out_of_stock' ? (
                        <ProductBadge tone="error">Out of Stock</ProductBadge>
                      ) : p.stockStatus === 'low_stock' ? (
                        <ProductBadge tone="warning">Low Stock</ProductBadge>
                      ) : (
                        <ProductBadge tone="success">In Stock</ProductBadge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                      {canUpdateStock && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('variants')}
                          className="rounded-lg border border-[#FF7A00]/35 bg-[#FFE4C7]/50 px-3 py-1.5 text-xs font-semibold text-[#1F1D2B] hover:bg-[#FF7A00] hover:text-white cursor-pointer"
                        >
                          Adjust Stock
                        </button>
                      )}
                      {canManageProducts && (
                        <button
                          type="button"
                          onClick={() => onEditProduct(p.id)}
                          className="rounded-lg border border-[#1F1D2B]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#1F1D2B] hover:border-[#FF7A00] hover:text-[#FF7A00] cursor-pointer"
                        >
                          Edit Catalog
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'variants' ? (
        <div className="space-y-4">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-4 sm:p-5 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1F1D2B]/8">
                <div className="flex items-center gap-3">
                  <ResilientImage
                    src={p.mainImage}
                    alt={p.name}
                    className="h-11 w-9 rounded-lg object-cover bg-[#FFF8EF]"
                  />
                  <div>
                    <h3 className="font-heading text-sm font-bold text-[#1F1D2B]">{p.name}</h3>
                    <p className="text-xs text-[#1F1D2B]/55">
                      {p.sku} · {p.variants.length} colour × size SKUs
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#1F1D2B] tabular-nums">
                    Total Stock: {p.totalStock}
                  </span>
                  {p.stockStatus === 'out_of_stock' ? (
                    <ProductBadge tone="error">Out of Stock</ProductBadge>
                  ) : p.stockStatus === 'low_stock' ? (
                    <ProductBadge tone="warning">Low Stock</ProductBadge>
                  ) : (
                    <ProductBadge tone="success">In Stock</ProductBadge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {p.variants.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[#1F1D2B]/10 bg-[#FFF8EF]/65 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-[#1F1D2B]/25 shrink-0"
                          style={{ backgroundColor: v.colourHex }}
                        />
                        <span className="text-xs font-semibold text-[#1F1D2B] truncate">
                          {v.colour} · {v.size}
                        </span>
                      </div>
                      <p className="text-[10px] font-mono text-[#1F1D2B]/55 truncate mt-0.5">
                        {v.sku}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`font-mono text-xs font-bold tabular-nums px-2 py-1 rounded-lg ${
                          v.stockQuantity === 0
                            ? 'bg-[#DC2626]/12 text-[#DC2626]'
                            : v.stockQuantity <= (p.lowStockThreshold || lowStockThreshold)
                              ? 'bg-[#F59E0B]/15 text-[#F59E0B]'
                              : 'bg-white text-[#1F1D2B] border border-[#1F1D2B]/12'
                        }`}
                      >
                        {v.stockQuantity}
                      </span>
                      {canUpdateStock && (
                        <button
                          type="button"
                          onClick={() => openAdjustDialog(p, v)}
                          aria-label={`Adjust stock for ${p.name} ${v.colour} ${v.size}`}
                          className="rounded-lg border border-[#1F1D2B]/15 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#1F1D2B] hover:border-[#FF7A00] hover:text-[#FF7A00] cursor-pointer"
                        >
                          Adjust
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : activeTab === 'breakdown' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Size-Wise Inventory */}
          <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1F1D2B]/10 pb-3">
              <div className="flex items-center gap-2">
                <Ruler className="h-4 w-4 text-[#FF7A00]" />
                <h3 className="font-heading text-base font-bold text-[#1F1D2B]">
                  Size-Wise Inventory Distribution
                </h3>
              </div>
              <span className="text-xs text-[#1F1D2B]/55 tabular-nums">
                {summary.sizeBreakdown.length} sizes
              </span>
            </div>
            <div className="space-y-3">
              {summary.sizeBreakdown.map((row) => {
                const pct =
                  summary.totalUnits > 0
                    ? Math.round((row.units / summary.totalUnits) * 100)
                    : 0;
                return (
                  <div key={row.size} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#1F1D2B]">Size {row.size}</span>
                      <span className="font-mono font-semibold text-[#1F1D2B] tabular-nums">
                        {row.units} units ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#FFF8EF] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#FF7A00]"
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Colour-Wise Inventory */}
          <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1F1D2B]/10 pb-3">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-[#FF7A00]" />
                <h3 className="font-heading text-base font-bold text-[#1F1D2B]">
                  Colour-Wise Inventory Distribution
                </h3>
              </div>
              <span className="text-xs text-[#1F1D2B]/55 tabular-nums">
                {summary.colourBreakdown.length} colours
              </span>
            </div>
            <div className="space-y-3">
              {summary.colourBreakdown.map((row) => {
                const pct =
                  summary.totalUnits > 0
                    ? Math.round((row.units / summary.totalUnits) * 100)
                    : 0;
                return (
                  <div key={row.colour} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-2 font-semibold text-[#1F1D2B]">
                        <span
                          className="h-3 w-3 rounded-full border border-[#1F1D2B]/25"
                          style={{ backgroundColor: row.hex }}
                        />
                        {row.colour}
                      </span>
                      <span className="font-mono font-semibold text-[#1F1D2B] tabular-nums">
                        {row.units} units ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#FFF8EF] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#1F1D2B]"
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Immutable Inventory Movement History */
        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#1F1D2B]/10 px-5 py-4">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-[#FF7A00]" />
              <h3 className="font-heading text-sm font-bold text-[#1F1D2B]">
                Immutable Inventory Movement Ledger ({filteredMovements.length})
              </h3>
            </div>
            <span className="text-[11px] text-[#1F1D2B]/55">
              Append-only · Tamper-locked in Firestore rules
            </span>
          </div>
          {filteredMovements.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#1F1D2B]/60">
              No stock movements logged yet. Use &ldquo;Adjust Stock&rdquo; on any variant to record
              an audited stock change.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#1F1D2B]/10 bg-[#FFF8EF]/70 text-[#1F1D2B]/60">
                    <th className="py-3 px-4 font-semibold">Timestamp (IST)</th>
                    <th className="py-3 px-4 font-semibold">Product / Variant</th>
                    <th className="py-3 px-4 font-semibold">Type</th>
                    <th className="py-3 px-4 font-semibold text-right">Change</th>
                    <th className="py-3 px-4 font-semibold text-right">Stock</th>
                    <th className="py-3 px-4 font-semibold">Reason</th>
                    <th className="py-3 px-4 font-semibold">Actor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F1D2B]/8">
                  {filteredMovements.map((m) => (
                    <tr key={m.movementId} className="hover:bg-[#FFF8EF]/45">
                      <td className="py-3 px-4 text-[#1F1D2B]/65 tabular-nums whitespace-nowrap">
                        {new Date(m.createdAt).toLocaleString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-[#1F1D2B]">{m.productName}</p>
                        <p className="font-mono text-[11px] text-[#1F1D2B]/55">
                          {m.variantSku} · {m.colour} / {m.size}
                        </p>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-semibold text-[#1F1D2B]">
                        {movementLabel(m.movementType)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono font-bold tabular-nums ${
                          m.delta >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                        }`}
                      >
                        {m.delta >= 0 ? `+${m.delta}` : m.delta}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[#1F1D2B] tabular-nums whitespace-nowrap">
                        {m.previousStock} → <strong>{m.newStock}</strong>
                      </td>
                      <td className="py-3 px-4 text-[#1F1D2B]/80 max-w-xs">{m.reason}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <p className="font-semibold text-[#1F1D2B]">{m.actorName}</p>
                        <p className="text-[10px] uppercase text-[#1F1D2B]/50">
                          {m.actorRole.replace('_', ' ')}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Transactional Stock Adjustment Modal */}
      {adjustTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1D2B]/65 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Transactional Stock Adjustment"
        >
          <form
            onSubmit={handleConfirmStockAdjustment}
            className="w-full max-w-md rounded-2xl border border-[#1F1D2B]/15 bg-white p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#1F1D2B]/10 pb-3">
              <div>
                <p className="text-xs font-semibold text-[#FF7A00] flex items-center gap-1.5">
                  <ArrowDownUp className="h-3.5 w-3.5" />
                  Transactional Stock Adjustment
                </p>
                <h3 className="font-heading text-base font-bold text-[#1F1D2B] mt-0.5">
                  {adjustTarget.product.name}
                </h3>
                <p className="text-xs text-[#1F1D2B]/60 font-mono">
                  {adjustTarget.variant.sku} · {adjustTarget.variant.colour} /{' '}
                  {adjustTarget.variant.size} (Current: {adjustTarget.variant.stockQuantity})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                className="text-xs font-semibold text-[#1F1D2B]/60 hover:text-[#1F1D2B] cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#1F1D2B] mb-1">
                  Adjustment Mode
                </label>
                <select
                  value={adjustMode}
                  onChange={(e) => setAdjustMode(e.target.value as 'delta' | 'set')}
                  className="w-full h-10 rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-xs font-semibold text-[#1F1D2B] focus:border-[#FF7A00] focus:outline-none"
                >
                  <option value="delta">Add / Subtract (+/-)</option>
                  <option value="set">Set Exact Count</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1F1D2B] mb-1">
                  Movement Type
                </label>
                <select
                  value={movementType}
                  onChange={(e) =>
                    setMovementType(e.target.value as InventoryMovementDoc['movementType'])
                  }
                  className="w-full h-10 rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-xs font-semibold text-[#1F1D2B] focus:border-[#FF7A00] focus:outline-none"
                >
                  <option value="restock">Restock</option>
                  <option value="manual_adjustment">Manual Adjustment</option>
                  <option value="damage">Damage / Shrinkage</option>
                  <option value="return_restock">Customer Return</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1F1D2B] mb-1">
                {adjustMode === 'delta'
                  ? 'Delta Quantity (e.g. +10 or -2)'
                  : 'New Exact Stock Quantity'}
              </label>
              <input
                type="number"
                required
                step={1}
                value={adjustValue}
                onChange={(e) => setAdjustValue(e.target.value)}
                className="w-full h-10 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3 font-mono text-sm font-bold text-[#1F1D2B] focus:border-[#FF7A00] focus:bg-white focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-[#1F1D2B]/60 tabular-nums">
                Projected Stock:{' '}
                <strong>
                  {adjustMode === 'set'
                    ? Number(adjustValue || 0)
                    : adjustTarget.variant.stockQuantity + Number(adjustValue || 0)}
                </strong>{' '}
                units (Negative stock is blocked on server &amp; Firestore rules)
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1F1D2B] mb-1">
                Audit Reason (Required)
              </label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={280}
                placeholder="e.g. Warehouse Diwali batch restock #PO-209"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="w-full h-10 rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-xs text-[#1F1D2B] focus:border-[#FF7A00] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1F1D2B]/10">
              <Button type="button" variant="outline" size="sm" onClick={() => setAdjustTarget(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={adjustBusy}
                leftIcon={
                  adjustBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : undefined
                }
              >
                {adjustBusy ? 'Committing...' : 'Commit Stock Change'}
              </Button>
            </div>
          </form>
        </div>
      )}

      <StatusAlert
        variant={monitor.dataSource === 'firestore' ? 'success' : 'info'}
        title={
          monitor.dataSource === 'firestore'
            ? 'Transactional Cloud Firestore Stock Sync Active'
            : 'Local Catalog Fallback Active'
        }
        description="Every stock update runs through /api/admin/inventory/adjust with optimistic concurrency locking, non-negative validation, and immutable movement logging."
      />
    </div>
  );
};
