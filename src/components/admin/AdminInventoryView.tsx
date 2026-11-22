import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Layers, PackageX, Sliders } from 'lucide-react';
import { useCatalog } from '../../context/CatalogContext';
import { formatINR } from '../../utils/catalogHelpers';
import { ProductBadge, ResilientImage, SearchBar, StatusAlert } from '../ui/Primitives';

interface AdminInventoryViewProps {
  initialTab?: 'stock' | 'variants';
  onEditProduct: (productId: string) => void;
}

export const AdminInventoryView: React.FC<AdminInventoryViewProps> = ({
  initialTab = 'stock',
  onEditProduct,
}) => {
  const { products, lowStockThreshold, setLowStockThreshold, updateVariantStock } = useCatalog();
  const [activeTab, setActiveTab] = useState<'stock' | 'variants'>(initialTab);
  const [query, setQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>(
    'all'
  );

  const summary = useMemo(() => {
    let totalUnits = 0;
    let totalVariants = 0;
    let lowStockProducts = 0;
    let outOfStockProducts = 0;
    let inventoryValue = 0;

    for (const p of products) {
      totalUnits += p.totalStock;
      totalVariants += p.variants.length;
      inventoryValue += p.totalStock * p.sellingPrice;
      if (p.stockStatus === 'low_stock') lowStockProducts += 1;
      if (p.stockStatus === 'out_of_stock') outOfStockProducts += 1;
    }

    return {
      totalUnits,
      totalVariants,
      lowStockProducts,
      outOfStockProducts,
      inventoryValue,
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

  return (
    <div className="space-y-6">
      {/* Header & View Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#FF7A00]">Inventory Foundation · Phase 4</p>
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-[#1F1D2B]">
            Stock Overview &amp; Product Variants
          </h2>
          <p className="text-xs text-[#1F1D2B]/65 mt-0.5">
            Track real-time totals across every colour × size variant. Order-based automatic stock
            deduction connects in Phase 5+.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Configurable Global Low-Stock Threshold */}
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

          <div className="inline-flex rounded-xl border border-[#1F1D2B]/12 bg-white p-1">
            <button
              type="button"
              onClick={() => setActiveTab('stock')}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer transition-colors ${
                activeTab === 'stock'
                  ? 'bg-[#1F1D2B] text-[#FFF8EF]'
                  : 'text-[#1F1D2B]/70 hover:text-[#1F1D2B]'
              }`}
            >
              Stock Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('variants')}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer transition-colors ${
                activeTab === 'variants'
                  ? 'bg-[#1F1D2B] text-[#FFF8EF]'
                  : 'text-[#1F1D2B]/70 hover:text-[#1F1D2B]'
              }`}
            >
              Product Variants ({summary.totalVariants})
            </button>
          </div>
        </div>
      </div>

      {/* Inventory KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-[#1F1D2B]/60">Total Available Stock</p>
            <p className="mt-1 font-heading text-2xl font-bold text-[#1F1D2B] tabular-nums">
              {summary.totalUnits} units
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
            <p className="text-[11px] text-[#1F1D2B]/55 mt-0.5">At or below threshold</p>
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
            <p className="text-[11px] text-[#1F1D2B]/55 mt-0.5">Requires restock</p>
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
            placeholder="Search product, SKU, or colour..."
          />
        </div>
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
      </div>

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
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onEditProduct(p.id)}
                        className="rounded-lg border border-[#1F1D2B]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#1F1D2B] hover:border-[#FF7A00] hover:text-[#FF7A00] cursor-pointer"
                      >
                        Edit Variants
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
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
                    <input
                      type="number"
                      min={0}
                      max={9999}
                      aria-label={`Stock for ${p.name} ${v.colour} ${v.size}`}
                      value={v.stockQuantity}
                      onChange={(e) =>
                        updateVariantStock(p.id, v.id, Math.max(0, Number(e.target.value)))
                      }
                      className="w-16 h-9 rounded-lg border border-[#1F1D2B]/15 bg-white px-2 text-center font-mono text-xs font-bold text-[#1F1D2B] focus:border-[#FF7A00] focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <StatusAlert
        variant="warning"
        title="Phase 4 Inventory Foundation (Local Demo Mode)"
        description="Variant stock edits recalculate exact total stock and low/out-of-stock indicators immediately. Automated order-based stock deduction is reserved for Phase 5/6."
      />
    </div>
  );
};
