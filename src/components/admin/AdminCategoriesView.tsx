import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Edit3,
  FolderPlus,
  FolderTree,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCatalog } from '../../context/CatalogContext';
import { isFirebaseConfigured } from '../../firebase/firebaseConfig';
import { uploadProductImageToFirebaseStorage } from '../../firebase/storage';
import type { CatalogCategory, ProductVisibilityStatus } from '../../types/catalog';
import { Button, InputField, ProductBadge, ResilientImage, StatusAlert } from '../ui/Primitives';
import { ConfirmationDialog, useToast } from '../ui/Overlays';

export const AdminCategoriesView: React.FC = () => {
  const { isAdmin } = useAuth();
  const { addToast } = useToast();
  const {
    categories,
    products,
    monitor,
    addCategory,
    updateCategory,
    reorderCategories,
    reassignProductsCategory,
    deleteCategory,
    addSubcategory,
    deleteSubcategory,
  } = useCatalog();

  const [newCatName, setNewCatName] = useState('');
  const [newCatDept, setNewCatDept] = useState<CatalogCategory['departmentKey']>('Custom');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatStatus, setNewCatStatus] = useState<ProductVisibilityStatus>('published');
  const [newCatImage, setNewCatImage] = useState('');
  const [uploadingImageFor, setUploadingImageFor] = useState<string | null>(null);
  const [catError, setCatError] = useState('');

  const [editingCat, setEditingCat] = useState<CatalogCategory | null>(null);
  const [subInputs, setSubInputs] = useState<Record<string, string>>({});
  const [confirmDeleteCat, setConfirmDeleteCat] = useState<CatalogCategory | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<string>('');
  const [deletingBusy, setDeletingBusy] = useState(false);

  const handleUploadCategoryImage = async (file: File, targetCatId: string | 'new') => {
    if (!isFirebaseConfigured || !isAdmin) {
      addToast({
        type: 'warning',
        title: 'Firebase Storage Requires Admin Sign-In',
        description: 'Sign in with a verified Admin account when Firebase is configured to upload category banners.',
      });
      return;
    }
    setUploadingImageFor(targetCatId);
    try {
      const uploaded = await uploadProductImageToFirebaseStorage(file, {
        productId: `category-${targetCatId}`,
        viewType: 'Front View',
        order: 0,
        isMain: true,
      });
      if (targetCatId === 'new') {
        setNewCatImage(uploaded.url);
      } else {
        updateCategory(targetCatId, { image: uploaded.url });
      }
      addToast({
        type: 'success',
        title: 'Category Image Uploaded',
        description: 'Uploaded compressed banner to Firebase Cloud Storage.',
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Image Upload Failed',
        description: err instanceof Error ? err.message : 'Unable to upload image.',
      });
    } finally {
      setUploadingImageFor(null);
    }
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      setCatError('Please enter a category name.');
      return;
    }
    setCatError('');
    const created = addCategory({
      name: newCatName,
      departmentKey: newCatDept,
      description: newCatDesc,
      image: newCatImage || undefined,
      status: newCatStatus,
    });
    if (created) {
      setNewCatName('');
      setNewCatDesc('');
      setNewCatImage('');
      setNewCatStatus('published');
      setNewCatDept('Custom');
    }
  };

  const handleAddSubcategory = (categoryId: string) => {
    const val = (subInputs[categoryId] || '').trim();
    if (!val) return;
    addSubcategory(categoryId, val);
    setSubInputs((prev) => ({ ...prev, [categoryId]: '' }));
  };

  const handleMoveCategory = (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= categories.length) return;
    const ids = categories.map((c) => c.id);
    const [moved] = ids.splice(idx, 1);
    ids.splice(targetIdx, 0, moved);
    reorderCategories(ids);
  };

  const handleSaveEditCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCat) return;
    updateCategory(editingCat.id, {
      name: editingCat.name,
      departmentKey: editingCat.departmentKey,
      description: editingCat.description,
      status: editingCat.status || 'published',
      image: editingCat.image,
    });
    setEditingCat(null);
  };

  const handleConfirmDeleteCategory = async () => {
    if (!confirmDeleteCat || deletingBusy) return;
    const inUseCount = products.filter((p) => p.categoryId === confirmDeleteCat.id).length;
    setDeletingBusy(true);
    try {
      if (inUseCount > 0) {
        if (!reassignTargetId || reassignTargetId === confirmDeleteCat.id) {
          addToast({
            type: 'error',
            title: 'Select Destination Category',
            description: `${inUseCount} product(s) must be reassigned to another category before deletion.`,
          });
          return;
        }
        const ok = await reassignProductsCategory(confirmDeleteCat.id, reassignTargetId);
        if (!ok) return;
      }
      deleteCategory(confirmDeleteCat.id);
      setConfirmDeleteCat(null);
      setReassignTargetId('');
    } finally {
      setDeletingBusy(false);
    }
  };

  const deleteInUseCount = confirmDeleteCat
    ? products.filter((p) => p.categoryId === confirmDeleteCat.id).length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#FF7A00]">Catalog Taxonomy &amp; Ordering</p>
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-[#1F1D2B]">
            Categories &amp; Subcategories
          </h2>
          <p className="text-xs text-[#1F1D2B]/65 mt-0.5">
            Create, edit, reorder, upload category banners, toggle visibility, and safely reassign
            products before category removal.
          </p>
        </div>
        <div className="text-xs font-semibold text-[#1F1D2B]/70 tabular-nums">
          {categories.length} Main Categories ·{' '}
          {categories.reduce((acc, c) => acc + c.subcategories.length, 0)} Subcategories
        </div>
      </div>

      {/* Create Category Form */}
      <form
        onSubmit={handleCreateCategory}
        className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FolderPlus className="h-4 w-4 text-[#FF7A00]" />
            <h3 className="font-heading text-sm font-semibold text-[#1F1D2B]">
              Create Category
            </h3>
          </div>
          <label className="inline-flex items-center gap-1.5 rounded-lg border border-[#1F1D2B]/15 bg-[#FFF8EF] px-3 py-1.5 text-xs font-semibold text-[#1F1D2B] hover:border-[#FF7A00] cursor-pointer">
            {uploadingImageFor === 'new' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#FF7A00]" />
            ) : (
              <Upload className="h-3.5 w-3.5 text-[#FF7A00]" />
            )}
            <span>{newCatImage ? 'Banner Uploaded' : 'Upload Banner Image'}</span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUploadCategoryImage(file, 'new');
              }}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          <div className="md:col-span-3">
            <InputField
              id="new-category-name"
              label="Category Name"
              placeholder="e.g. Resort Couture"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              error={catError}
              required
            />
          </div>

          <div className="md:col-span-3 space-y-1.5">
            <label htmlFor="new-category-dept" className="block text-xs font-semibold text-[#1F1D2B]">
              Storefront Department
            </label>
            <select
              id="new-category-dept"
              value={newCatDept}
              onChange={(e) =>
                setNewCatDept(e.target.value as CatalogCategory['departmentKey'])
              }
              className="w-full h-11 rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-sm text-[#1F1D2B] focus:border-[#FF7A00] focus:outline-none"
            >
              <option value="Custom">Custom Collection</option>
              <option value="Men">Men&apos;s Fashion</option>
              <option value="Women">Women&apos;s Fashion</option>
              <option value="Kids">Kids Fashion</option>
              <option value="Traditional Wear">Traditional Wear</option>
              <option value="Collections">Other Collections</option>
            </select>
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label htmlFor="new-category-status" className="block text-xs font-semibold text-[#1F1D2B]">
              Visibility
            </label>
            <select
              id="new-category-status"
              value={newCatStatus}
              onChange={(e) => setNewCatStatus(e.target.value as ProductVisibilityStatus)}
              className="w-full h-11 rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-sm text-[#1F1D2B] focus:border-[#FF7A00] focus:outline-none"
            >
              <option value="published">Published</option>
              <option value="draft">Draft (Hidden)</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <InputField
              id="new-category-desc"
              label="Description"
              placeholder="Short summary"
              value={newCatDesc}
              onChange={(e) => setNewCatDesc(e.target.value)}
            />
          </div>

          <div className="md:col-span-2 md:pt-6">
            <Button type="submit" variant="primary" size="md" fullWidth leftIcon={<Plus className="h-4 w-4" />}>
              Add
            </Button>
          </div>
        </div>
      </form>

      {/* Category Hierarchy Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {categories.map((cat, idx) => {
          const catProductCount = products.filter((p) => p.categoryId === cat.id).length;
          const status = cat.status || 'published';
          return (
            <div
              key={cat.id}
              className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-xl border border-[#1F1D2B]/12 bg-[#FFF8EF]">
                      <ResilientImage
                        src={cat.image}
                        alt={cat.name}
                        className="h-full w-full object-cover"
                      />
                      <label
                        title="Upload category image"
                        className="absolute inset-0 flex items-center justify-center bg-[#1F1D2B]/55 opacity-0 hover:opacity-100 transition-opacity text-white cursor-pointer"
                      >
                        {uploadingImageFor === cat.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleUploadCategoryImage(f, cat.id);
                          }}
                        />
                      </label>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <FolderTree className="h-4 w-4 text-[#FF7A00] shrink-0" />
                        <h3 className="font-heading text-base font-bold text-[#1F1D2B]">
                          {cat.name}
                        </h3>
                        <ProductBadge
                          tone={
                            status === 'published'
                              ? 'success'
                              : status === 'draft'
                                ? 'warning'
                                : 'neutral'
                          }
                        >
                          {status}
                        </ProductBadge>
                      </div>
                      <p className="mt-1 text-xs text-[#1F1D2B]/60 tabular-nums">
                        #{idx + 1} · /{cat.slug} · {catProductCount} product
                        {catProductCount === 1 ? '' : 's'}
                      </p>
                      <p className="mt-1 text-xs text-[#1F1D2B]/75 line-clamp-2">
                        {cat.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveCategory(idx, -1)}
                      aria-label={`Move ${cat.name} up`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1F1D2B]/12 text-[#1F1D2B]/70 hover:border-[#FF7A00] disabled:opacity-35 cursor-pointer"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === categories.length - 1}
                      onClick={() => handleMoveCategory(idx, 1)}
                      aria-label={`Move ${cat.name} down`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1F1D2B]/12 text-[#1F1D2B]/70 hover:border-[#FF7A00] disabled:opacity-35 cursor-pointer"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCat({ ...cat })}
                      aria-label={`Edit ${cat.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1F1D2B]/12 text-[#1F1D2B] hover:border-[#FF7A00] hover:text-[#FF7A00] cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    {cat.isCustom && (
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDeleteCat(cat);
                          const fallbackTarget = categories.find((c) => c.id !== cat.id)?.id || '';
                          setReassignTargetId(fallbackTarget);
                        }}
                        aria-label={`Delete ${cat.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DC2626]/25 text-[#DC2626] hover:bg-[#DC2626] hover:text-white cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Subcategories List */}
                <div className="border-t border-[#1F1D2B]/10 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1F1D2B]/55 mb-2">
                    Subcategories ({cat.subcategories.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {cat.subcategories.length === 0 ? (
                      <span className="text-xs text-[#1F1D2B]/50">
                        No subcategories yet. Add one below.
                      </span>
                    ) : (
                      cat.subcategories.map((sub) => {
                        const subCount = products.filter((p) => p.subcategoryId === sub.id).length;
                        return (
                          <div
                            key={sub.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#1F1D2B]/12 bg-[#FFF8EF] px-2.5 py-1.5 text-xs text-[#1F1D2B]"
                          >
                            <span className="font-medium">{sub.name}</span>
                            <span className="text-[11px] text-[#1F1D2B]/50 tabular-nums">
                              ({subCount})
                            </span>
                            <button
                              type="button"
                              onClick={() => deleteSubcategory(cat.id, sub.id)}
                              aria-label={`Remove subcategory ${sub.name}`}
                              className="ml-0.5 text-[#1F1D2B]/45 hover:text-[#DC2626] cursor-pointer"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Inline Add Subcategory Row */}
              <div className="flex items-center gap-2 border-t border-[#1F1D2B]/10 pt-3">
                <input
                  type="text"
                  value={subInputs[cat.id] || ''}
                  onChange={(e) =>
                    setSubInputs((prev) => ({ ...prev, [cat.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSubcategory(cat.id);
                    }
                  }}
                  placeholder={`Add subcategory under ${cat.name}...`}
                  className="flex-1 h-10 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3 text-xs text-[#1F1D2B] placeholder:text-[#1F1D2B]/45 focus:border-[#FF7A00] focus:bg-white focus:outline-none"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleAddSubcategory(cat.id)}
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  Add
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Category Modal */}
      {editingCat && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1D2B]/65 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Edit Category"
        >
          <form
            onSubmit={handleSaveEditCategory}
            className="w-full max-w-md rounded-2xl border border-[#1F1D2B]/15 bg-white p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#1F1D2B]/10 pb-3">
              <h3 className="font-heading text-base font-bold text-[#1F1D2B]">
                Edit Category · {editingCat.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingCat(null)}
                className="text-xs font-semibold text-[#1F1D2B]/60 hover:text-[#1F1D2B] cursor-pointer"
              >
                Close
              </button>
            </div>
            <InputField
              id="edit-cat-name"
              label="Category Name"
              value={editingCat.name}
              onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#1F1D2B] mb-1">
                  Department
                </label>
                <select
                  value={editingCat.departmentKey}
                  onChange={(e) =>
                    setEditingCat({
                      ...editingCat,
                      departmentKey: e.target.value as CatalogCategory['departmentKey'],
                    })
                  }
                  className="w-full h-10 rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-xs text-[#1F1D2B]"
                >
                  <option value="Custom">Custom Collection</option>
                  <option value="Men">Men&apos;s Fashion</option>
                  <option value="Women">Women&apos;s Fashion</option>
                  <option value="Kids">Kids Fashion</option>
                  <option value="Traditional Wear">Traditional Wear</option>
                  <option value="Collections">Other Collections</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1F1D2B] mb-1">
                  Visibility Status
                </label>
                <select
                  value={editingCat.status || 'published'}
                  onChange={(e) =>
                    setEditingCat({
                      ...editingCat,
                      status: e.target.value as ProductVisibilityStatus,
                    })
                  }
                  className="w-full h-10 rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-xs text-[#1F1D2B]"
                >
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
            <InputField
              id="edit-cat-desc"
              label="Description"
              value={editingCat.description}
              onChange={(e) => setEditingCat({ ...editingCat, description: e.target.value })}
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-[#1F1D2B]/10">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingCat(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Save Category
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Safe Delete with Reassignment Picker when Products Exist */}
      {confirmDeleteCat && deleteInUseCount > 0 ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1D2B]/65 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Reassign and Delete Category"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#DC2626]/25 bg-white p-6 shadow-2xl space-y-4">
            <h3 className="font-heading text-base font-bold text-[#1F1D2B]">
              Reassign {deleteInUseCount} Product(s) Before Deleting &ldquo;{confirmDeleteCat.name}
              &rdquo;
            </h3>
            <p className="text-xs text-[#1F1D2B]/70 leading-relaxed">
              Deleting a category with active products is blocked unless you safely reassign those
              products to another published category below.
            </p>
            <div>
              <label className="block text-xs font-semibold text-[#1F1D2B] mb-1">
                Destination Category
              </label>
              <select
                value={reassignTargetId}
                onChange={(e) => setReassignTargetId(e.target.value)}
                className="w-full h-10 rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-xs font-semibold text-[#1F1D2B]"
              >
                {categories
                  .filter((c) => c.id !== confirmDeleteCat.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.departmentKey})
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#1F1D2B]/10">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmDeleteCat(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={deletingBusy}
                onClick={() => void handleConfirmDeleteCategory()}
              >
                {deletingBusy ? 'Reassigning...' : 'Reassign & Delete Category'}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <ConfirmationDialog
          open={Boolean(confirmDeleteCat)}
          onClose={() => setConfirmDeleteCat(null)}
          onConfirm={() => void handleConfirmDeleteCategory()}
          title={`Delete Category "${confirmDeleteCat?.name || ''}"?`}
          message="This category currently has 0 assigned products and can be removed safely from the catalog taxonomy."
          confirmLabel="Delete Category"
          destructive
        />
      )}

      <StatusAlert
        variant={monitor.dataSource === 'firestore' ? 'success' : 'info'}
        title={
          monitor.dataSource === 'firestore'
            ? 'Live Cloud Firestore Taxonomy Connected'
            : 'Local Demo Taxonomy · Ready for Firestore Migration'
        }
        description="Category ordering, visibility toggles, and banner updates sync directly to Cloud Firestore and audit logs."
      />
    </div>
  );
};
