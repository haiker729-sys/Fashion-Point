import React, { useState } from 'react';
import { FolderPlus, FolderTree, Plus, Trash2 } from 'lucide-react';
import { useCatalog } from '../../context/CatalogContext';
import type { CatalogCategory } from '../../types/catalog';
import { Button, InputField, StatusAlert } from '../ui/Primitives';
import { ConfirmationDialog } from '../ui/Overlays';

export const AdminCategoriesView: React.FC = () => {
  const {
    categories,
    products,
    monitor,
    addCategory,
    deleteCategory,
    addSubcategory,
    deleteSubcategory,
  } = useCatalog();

  const [newCatName, setNewCatName] = useState('');
  const [newCatDept, setNewCatDept] = useState<CatalogCategory['departmentKey']>('Custom');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [catError, setCatError] = useState('');

  const [subInputs, setSubInputs] = useState<Record<string, string>>({});
  const [confirmDeleteCat, setConfirmDeleteCat] = useState<CatalogCategory | null>(null);

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
    });
    if (created) {
      setNewCatName('');
      setNewCatDesc('');
      setNewCatDept('Custom');
    }
  };

  const handleAddSubcategory = (categoryId: string) => {
    const val = (subInputs[categoryId] || '').trim();
    if (!val) return;
    addSubcategory(categoryId, val);
    setSubInputs((prev) => ({ ...prev, [categoryId]: '' }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#FF7A00]">Catalog Taxonomy</p>
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-[#1F1D2B]">
            Categories &amp; Subcategories
          </h2>
          <p className="text-xs text-[#1F1D2B]/65 mt-0.5">
            Manage all 5 official fashion departments and create custom categories or subcategories.
          </p>
        </div>
        <div className="text-xs font-semibold text-[#1F1D2B]/70 tabular-nums">
          {categories.length} Main Categories ·{' '}
          {categories.reduce((acc, c) => acc + c.subcategories.length, 0)} Subcategories
        </div>
      </div>

      {/* Create Custom Category Card */}
      <form
        onSubmit={handleCreateCategory}
        className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 space-y-4"
      >
        <div className="flex items-center gap-2">
          <FolderPlus className="h-4 w-4 text-[#FF7A00]" />
          <h3 className="font-heading text-sm font-semibold text-[#1F1D2B]">
            Create Custom Category
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          <div className="md:col-span-4">
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
            <label
              htmlFor="new-category-dept"
              className="block text-xs font-semibold text-[#1F1D2B]"
            >
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

          <div className="md:col-span-3">
            <InputField
              id="new-category-desc"
              label="Description"
              placeholder="Short collection summary"
              value={newCatDesc}
              onChange={(e) => setNewCatDesc(e.target.value)}
            />
          </div>

          <div className="md:col-span-2 md:pt-6">
            <Button type="submit" variant="primary" size="md" fullWidth leftIcon={<Plus className="h-4 w-4" />}>
              Add Category
            </Button>
          </div>
        </div>
      </form>

      {/* Category Hierarchy Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {categories.map((cat) => {
          const catProductCount = products.filter((p) => p.categoryId === cat.id).length;
          return (
            <div
              key={cat.id}
              className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <FolderTree className="h-4 w-4 text-[#FF7A00] shrink-0" />
                      <h3 className="font-heading text-base font-bold text-[#1F1D2B]">
                        {cat.name}
                      </h3>
                    </div>
                    <p className="mt-1 text-xs text-[#1F1D2B]/60">
                      /{cat.slug} · {catProductCount} product{catProductCount === 1 ? '' : 's'} ·{' '}
                      {cat.isCustom ? 'Custom Category' : 'Core Department'}
                    </p>
                    <p className="mt-1.5 text-xs text-[#1F1D2B]/75">{cat.description}</p>
                  </div>

                  {cat.isCustom && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteCat(cat)}
                      aria-label={`Delete ${cat.name}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#DC2626]/25 text-[#DC2626] hover:bg-[#DC2626] hover:text-white cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
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

      <StatusAlert
        variant={monitor.dataSource === 'firestore' ? 'success' : 'info'}
        title={
          monitor.dataSource === 'firestore'
            ? 'Live Cloud Firestore Taxonomy Connected'
            : 'Local Demo Taxonomy · Ready for Firestore Migration'
        }
        description={
          monitor.dataSource === 'firestore'
            ? 'Category and subcategory edits sync in real time with Cloud Firestore and update storefront filters immediately.'
            : 'Use Settings → Firebase Database & Migration to import these categories into Cloud Firestore.'
        }
      />

      <ConfirmationDialog
        open={Boolean(confirmDeleteCat)}
        onClose={() => setConfirmDeleteCat(null)}
        onConfirm={() => {
          if (confirmDeleteCat) deleteCategory(confirmDeleteCat.id);
        }}
        title={`Delete Category "${confirmDeleteCat?.name || ''}"?`}
        message="This removes the custom category from the local demo catalog. Categories with assigned products are protected from deletion."
        confirmLabel="Delete Category"
        destructive
      />
    </div>
  );
};
