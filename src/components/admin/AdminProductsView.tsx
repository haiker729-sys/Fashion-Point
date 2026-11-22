import React, { useMemo, useState } from 'react';
import {
  Box,
  ChevronLeft,
  ChevronRight,
  Edit3,
  ExternalLink,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useCatalog } from '../../context/CatalogContext';
import { useRouter } from '../../router/RouterContext';
import type { ProductVisibilityStatus, ResolvedCatalogProduct } from '../../types/catalog';
import { formatINR } from '../../utils/catalogHelpers';
import { Button, EmptyState, ProductBadge, ResilientImage, SearchBar } from '../ui/Primitives';
import { ConfirmationDialog } from '../ui/Overlays';

interface AdminProductsViewProps {
  onAddProduct: () => void;
  onEditProduct: (productId: string) => void;
}

const PAGE_SIZE = 6;

export const AdminProductsView: React.FC<AdminProductsViewProps> = ({
  onAddProduct,
  onEditProduct,
}) => {
  const { navigate } = useRouter();
  const {
    products,
    categories,
    monitor,
    deleteProduct,
    bulkUpdateStatus,
    bulkDeleteProducts,
    resetDemoCatalog,
  } = useCatalog();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ProductVisibilityStatus>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>(
    'all'
  );
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<ResolvedCatalogProduct | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== 'all' && p.categoryId !== categoryFilter) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (stockFilter !== 'all' && p.stockStatus !== stockFilter) return false;
      if (q) {
        const hay = `${p.name} ${p.sku} ${p.brand} ${p.categoryName} ${p.subcategoryName} ${p.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [products, search, categoryFilter, statusFilter, stockFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage]
  );

  const allOnPageSelected =
    paginated.length > 0 && paginated.every((p) => selectedIds.includes(p.id));

  const toggleSelectAllOnPage = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !paginated.some((p) => p.id === id)));
    } else {
      const next = new Set(selectedIds);
      paginated.forEach((p) => next.add(p.id));
      setSelectedIds(Array.from(next));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBulkStatus = (nextStatus: ProductVisibilityStatus) => {
    bulkUpdateStatus(selectedIds, nextStatus);
    setSelectedIds([]);
  };

  return (
    <div className="space-y-5">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#FF7A00]">
            {monitor.dataSource === 'firestore'
              ? 'Cloud Firestore · Real-Time Synchronized Catalog'
              : 'Local Demo Preview · Migrate to Cloud Firestore in Settings'}
          </p>
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-[#1F1D2B]">
            All Products ({products.length})
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
            onClick={resetDemoCatalog}
          >
            Reset Demo Data
          </Button>
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={onAddProduct}
          >
            Add New Product
          </Button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-5">
            <SearchBar
              value={search}
              onChange={(val) => {
                setSearch(val);
                setPage(1);
              }}
              placeholder="Search name, SKU, brand, tags..."
            />
          </div>

          <div className="lg:col-span-3">
            <select
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="w-full h-11 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3 text-xs font-semibold text-[#1F1D2B] focus:border-[#FF7A00] focus:outline-none"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Filter by visibility status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as typeof statusFilter);
                setPage(1);
              }}
              className="w-full h-11 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3 text-xs font-semibold text-[#1F1D2B] focus:border-[#FF7A00] focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Filter by stock status"
              value={stockFilter}
              onChange={(e) => {
                setStockFilter(e.target.value as typeof stockFilter);
                setPage(1);
              }}
              className="w-full h-11 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3 text-xs font-semibold text-[#1F1D2B] focus:border-[#FF7A00] focus:outline-none"
            >
              <option value="all">All Stock</option>
              <option value="in_stock">In Stock</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#FF7A00]/30 bg-[#FFE4C7]/55 px-4 py-2.5 text-xs">
            <span className="font-semibold text-[#1F1D2B] tabular-nums">
              {selectedIds.length} product{selectedIds.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleBulkStatus('published')}
                className="rounded-lg bg-[#16A34A] px-3 py-1.5 font-semibold text-white hover:opacity-90 cursor-pointer"
              >
                Publish Selected
              </button>
              <button
                type="button"
                onClick={() => handleBulkStatus('draft')}
                className="rounded-lg bg-[#F59E0B] px-3 py-1.5 font-semibold text-white hover:opacity-90 cursor-pointer"
              >
                Move to Draft
              </button>
              <button
                type="button"
                onClick={() => handleBulkStatus('archived')}
                className="rounded-lg bg-[#1F1D2B] px-3 py-1.5 font-semibold text-[#FFF8EF] hover:opacity-90 cursor-pointer"
              >
                Archive
              </button>
              <button
                type="button"
                onClick={() => setBulkDeleteConfirm(true)}
                className="rounded-lg bg-[#DC2626] px-3 py-1.5 font-semibold text-white hover:opacity-90 cursor-pointer"
              >
                Delete Selected
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Product Table */}
      {paginated.length === 0 ? (
        <EmptyState
          title="No products found"
          description="Adjust your search filters or add a new clothing product to the catalog."
          actionLabel="Add Product"
          onAction={onAddProduct}
        />
      ) : (
        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#1F1D2B]/10 bg-[#FFF8EF]/70 text-xs text-[#1F1D2B]/60">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleSelectAllOnPage}
                      aria-label="Select all products on page"
                      className="h-4 w-4 accent-[#FF7A00] cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-3 font-semibold">Product</th>
                  <th className="py-3 px-3 font-semibold">Category</th>
                  <th className="py-3 px-3 font-semibold text-right">Price (₹)</th>
                  <th className="py-3 px-3 font-semibold text-right">Stock</th>
                  <th className="py-3 px-3 font-semibold">3D Rack</th>
                  <th className="py-3 px-3 font-semibold">Visibility</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F1D2B]/8">
                {paginated.map((p) => {
                  const isChecked = selectedIds.includes(p.id);
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-[#FFF8EF]/55 transition-colors ${
                        isChecked ? 'bg-[#FFE4C7]/25' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectOne(p.id)}
                          aria-label={`Select ${p.name}`}
                          className="h-4 w-4 accent-[#FF7A00] cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3 min-w-[210px]">
                          <ResilientImage
                            src={p.mainImage}
                            alt={p.name}
                            className="h-12 w-10 rounded-lg object-cover bg-[#FFF8EF] shrink-0 border border-[#1F1D2B]/10"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-[#1F1D2B] truncate max-w-[220px]">
                              {p.name}
                            </p>
                            <p className="text-[11px] text-[#1F1D2B]/55 truncate">
                              {p.sku} · {p.brand}
                              {p.featured ? ' · Featured' : ''}
                              {p.bestSeller ? ' · Best Seller' : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-[#1F1D2B]/80 whitespace-nowrap">
                        <p className="font-medium">{p.categoryName}</p>
                        <p className="text-[11px] text-[#1F1D2B]/55">{p.subcategoryName}</p>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <p className="font-heading font-bold text-[#1F1D2B] tabular-nums">
                          {formatINR(p.legacyProduct.discountedPrice)}
                        </p>
                        {p.discountPercentage > 0 && (
                          <p className="text-[11px] text-[#1F1D2B]/50 tabular-nums">
                            <span className="line-through mr-1">{formatINR(p.originalPrice)}</span>
                            <span className="text-[#FF7A00] font-semibold">
                              -{p.discountPercentage}%
                            </span>
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <p className="font-semibold text-[#1F1D2B] tabular-nums">
                          {p.totalStock} units
                        </p>
                        <p
                          className={`text-[11px] font-semibold ${
                            p.stockStatus === 'out_of_stock'
                              ? 'text-[#DC2626]'
                              : p.stockStatus === 'low_stock'
                                ? 'text-[#F59E0B]'
                                : 'text-[#16A34A]'
                          }`}
                        >
                          {p.stockStatus === 'out_of_stock'
                            ? 'Out of Stock'
                            : p.stockStatus === 'low_stock'
                              ? 'Low Stock'
                              : `${p.variants.length} variants`}
                        </p>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-xs">
                        {p.showroomMapping.enabled ? (
                          <span className="inline-flex items-center gap-1 text-[#1F1D2B]/80 font-medium">
                            <Box className="h-3.5 w-3.5 text-[#FF7A00]" />
                            {p.showroomMapping.rackId}
                          </span>
                        ) : (
                          <span className="text-[#1F1D2B]/45">Online Only</span>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <ProductBadge
                          tone={
                            p.status === 'published'
                              ? 'success'
                              : p.status === 'draft'
                                ? 'warning'
                                : 'surface'
                          }
                        >
                          {p.status}
                        </ProductBadge>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => navigate(`/product/${p.slug}`)}
                            title="View customer product page"
                            aria-label={`View ${p.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1F1D2B]/12 text-[#1F1D2B] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditProduct(p.id)}
                            title="Edit product"
                            aria-label={`Edit ${p.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1F1D2B]/12 text-[#1F1D2B] hover:border-[#FF7A00] hover:text-[#FF7A00] cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(p)}
                            title="Delete product"
                            aria-label={`Delete ${p.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DC2626]/25 text-[#DC2626] hover:bg-[#DC2626] hover:text-white cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1F1D2B]/10 bg-[#FFF8EF]/60 px-4 py-3 text-xs">
            <span className="text-[#1F1D2B]/65 tabular-nums">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} products
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#1F1D2B]/15 bg-white px-2.5 font-semibold text-[#1F1D2B] disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </button>
              <span className="px-2 font-semibold text-[#1F1D2B] tabular-nums">
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#1F1D2B]/15 bg-white px-2.5 font-semibold text-[#1F1D2B] disabled:opacity-40 cursor-pointer"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Delete Confirmation */}
      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteProduct(deleteTarget.id);
            setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget.id));
          }
        }}
        title={`Delete "${deleteTarget?.name || ''}"?`}
        message="This permanently removes the product and all its colour/size variants from the local demo catalog and unmaps it from the 3D showroom."
        confirmLabel="Confirm Delete"
        destructive
      />

      {/* Bulk Delete Confirmation */}
      <ConfirmationDialog
        open={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={() => {
          bulkDeleteProducts(selectedIds);
          setSelectedIds([]);
        }}
        title={`Delete ${selectedIds.length} Selected Product${selectedIds.length > 1 ? 's' : ''}?`}
        message="All selected products and their variant stock records will be removed from the local demo catalog."
        confirmLabel="Delete All Selected"
        destructive
      />
    </div>
  );
};
