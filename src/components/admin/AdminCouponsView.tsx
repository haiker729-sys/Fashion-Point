import React, { useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  Loader2,
  Plus,
  ShieldCheck,
  Tag,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  deleteCouponApi,
  saveCouponApi,
  validateCouponServerApi,
} from '../../services/adminApi';
import type { CouponDoc } from '../../types/commerce';
import { REPORTING_TIMEZONE } from '../../utils/adminAnalytics';
import { formatINR } from '../../utils/catalogHelpers';
import { ConfirmationDialog, useToast } from '../ui/Overlays';
import { Button, ProductBadge, StatusAlert } from '../ui/Primitives';

interface AdminCouponsViewProps {
  coupons: CouponDoc[];
}

export const AdminCouponsView: React.FC<AdminCouponsViewProps> = ({ coupons }) => {
  const { user, hasPermission } = useAuth();
  const { addToast } = useToast();

  const canManage = hasPermission('coupons:manage');

  const [code, setCode] = useState('');
  const [type, setType] = useState<'percentage' | 'fixed'>('percentage');
  const [value, setValue] = useState('10');
  const [minOrderValue, setMinOrderValue] = useState('999');
  const [maxDiscount, setMaxDiscount] = useState('500');
  const [usageLimit, setUsageLimit] = useState('250');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState(
    new Date(Date.now() + 60 * 86400_000).toISOString().slice(0, 10)
  );
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Server-Side Coupon Validator Tester
  const [testCode, setTestCode] = useState('');
  const [testSubtotal, setTestSubtotal] = useState('2500');
  const [testResult, setTestResult] = useState<{
    valid: boolean;
    discount: number;
    message: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  const resetForm = () => {
    setCode('');
    setType('percentage');
    setValue('10');
    setMinOrderValue('999');
    setMaxDiscount('500');
    setUsageLimit('250');
    setStartDate(new Date().toISOString().slice(0, 10));
    setExpiryDate(new Date(Date.now() + 60 * 86400_000).toISOString().slice(0, 10));
    setDescription('');
    setActive(true);
    setEditingCode(null);
  };

  const loadForEdit = (c: CouponDoc) => {
    setEditingCode(c.code);
    setCode(c.code);
    setType(c.type);
    setValue(String(c.value));
    setMinOrderValue(String(c.minOrderValue));
    setMaxDiscount(String(c.maxDiscount));
    setUsageLimit(String(c.usageLimit));
    setStartDate(c.startDate.slice(0, 10));
    setExpiryDate(c.expiryDate.slice(0, 10));
    setDescription(c.description);
    setActive(c.active);
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || saving) return;
    setSaving(true);
    try {
      await saveCouponApi(user, {
        code: code.trim().toUpperCase(),
        type,
        value: Number(value),
        minOrderValue: Number(minOrderValue) || 0,
        maxDiscount: Number(maxDiscount) || 0,
        usageLimit: Math.floor(Number(usageLimit) || 0),
        startDate: new Date(`${startDate}T00:00:00.000Z`).toISOString(),
        expiryDate: new Date(`${expiryDate}T23:59:59.000Z`).toISOString(),
        active,
        description: description.trim() || 'Promotional Offer',
      });
      addToast({
        type: 'success',
        title: editingCode ? 'Coupon Updated' : 'Coupon Created',
        description: `Saved ${code.trim().toUpperCase()} to Cloud Firestore.`,
      });
      resetForm();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Save Failed',
        description: err instanceof Error ? err.message : 'Unable to save coupon.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (c: CouponDoc) => {
    if (!canManage) return;
    try {
      await saveCouponApi(user, {
        code: c.code,
        type: c.type,
        value: c.value,
        minOrderValue: c.minOrderValue,
        maxDiscount: c.maxDiscount,
        usageLimit: c.usageLimit,
        startDate: c.startDate,
        expiryDate: c.expiryDate,
        active: !c.active,
        description: c.description,
      });
      addToast({
        type: 'info',
        title: `Coupon ${c.code} ${!c.active ? 'Activated' : 'Deactivated'}`,
        description: 'Updated immediately in Cloud Firestore.',
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Toggle Failed',
        description: err instanceof Error ? err.message : 'Unable to update coupon state.',
      });
    }
  };

  const handleDeleteCoupon = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteCouponApi(user, deleteTarget);
      addToast({
        type: 'success',
        title: 'Coupon Deleted',
        description: `Removed coupon ${deleteTarget} from Firestore.`,
      });
      if (editingCode === deleteTarget) resetForm();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Delete Failed',
        description: err instanceof Error ? err.message : 'Unable to delete coupon.',
      });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleTestValidation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testCode.trim() || testing) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await validateCouponServerApi(user, testCode.trim(), Number(testSubtotal) || 0);
      setTestResult(res);
    } catch (err) {
      setTestResult({
        valid: false,
        discount: 0,
        message: err instanceof Error ? err.message : 'Validation request failed.',
      });
    } finally {
      setTesting(false);
    }
  };

  const nowMs = Date.now();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-[#FF7A00]">
          Promotional Pricing · Server-Side Checkout Enforcement
        </p>
        <h2 className="font-heading text-xl sm:text-2xl font-bold text-[#1F1D2B]">
          Offers &amp; Coupons Management ({coupons.length})
        </h2>
        <p className="text-xs text-[#1F1D2B]/65 mt-0.5">
          Create percentage or fixed-amount INR coupons with minimum order thresholds, maximum
          discount caps, usage limits, and expiry dates.
        </p>
      </div>

      {!canManage && (
        <StatusAlert
          variant="info"
          title="Read-Only Coupons View"
          description="Only Admin and Super Admin roles may create, edit, or delete discount coupons."
        />
      )}

      {/* Create / Edit Form */}
      {canManage && (
        <form
          onSubmit={handleSaveCoupon}
          className="rounded-2xl border border-[#1F1D2B]/12 bg-white p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-[#1F1D2B]/10 pb-3">
            <h3 className="font-heading text-sm font-bold text-[#1F1D2B] flex items-center gap-2">
              <Tag className="h-4 w-4 text-[#FF7A00]" />
              {editingCode ? `Edit Coupon: ${editingCode}` : 'Create New Discount Coupon'}
            </h3>
            {editingCode && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-semibold text-[#1F1D2B]/65 hover:text-[#FF7A00] cursor-pointer"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-[#1F1D2B]">Coupon Code *</label>
              <input
                type="text"
                required
                disabled={Boolean(editingCode)}
                maxLength={32}
                placeholder="e.g. FESTIVE20"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full h-10 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3 font-mono font-bold uppercase disabled:opacity-60"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[#1F1D2B]">Discount Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'percentage' | 'fixed')}
                className="w-full h-10 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3 font-semibold"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Flat Amount (₹)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[#1F1D2B]">
                {type === 'percentage' ? 'Discount % (1–90)' : 'Flat Discount (₹)'}
              </label>
              <input
                type="number"
                required
                min={1}
                max={type === 'percentage' ? 90 : 50000}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full h-10 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3 tabular-nums"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[#1F1D2B]">Min Order Value (₹)</label>
              <input
                type="number"
                min={0}
                value={minOrderValue}
                onChange={(e) => setMinOrderValue(e.target.value)}
                className="w-full h-10 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3 tabular-nums"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[#1F1D2B]">Max Discount Cap (₹, 0 = none)</label>
              <input
                type="number"
                min={0}
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(e.target.value)}
                className="w-full h-10 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3 tabular-nums"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[#1F1D2B]">Usage Limit (0 = unlimited)</label>
              <input
                type="number"
                min={0}
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                className="w-full h-10 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3 tabular-nums"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[#1F1D2B]">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-10 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[#1F1D2B]">Expiry Date</label>
              <input
                type="date"
                required
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full h-10 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3 font-mono"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <input
              type="text"
              maxLength={200}
              placeholder="Offer description shown at checkout (e.g. Festive Couture 10% Savings)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex-1 h-10 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3 text-xs"
            />
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#1F1D2B] cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 accent-[#FF7A00]"
              />
              Active Immediately
            </label>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={saving}
              leftIcon={
                saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />
              }
            >
              {saving ? 'Saving...' : editingCode ? 'Update Coupon' : 'Save Coupon'}
            </Button>
          </div>
        </form>
      )}

      {/* Coupons List */}
      <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white overflow-hidden">
        {coupons.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#1F1D2B]/60">
            No coupons created in Firestore yet. Create one above or seed sample coupons under
            Settings.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1F1D2B]/10 bg-[#FFF8EF]/70 text-[#1F1D2B]/60">
                  <th className="py-3 px-4 font-semibold">Code</th>
                  <th className="py-3 px-4 font-semibold">Discount</th>
                  <th className="py-3 px-4 font-semibold">Rules</th>
                  <th className="py-3 px-4 font-semibold text-right">Usage</th>
                  <th className="py-3 px-4 font-semibold">Validity (IST)</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  {canManage && <th className="py-3 px-4 font-semibold text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F1D2B]/8">
                {coupons.map((c) => {
                  const isExpired = Date.parse(c.expiryDate) < nowMs;
                  const limitReached = c.usageLimit > 0 && c.usedCount >= c.usageLimit;
                  return (
                    <tr key={c.code} className="hover:bg-[#FFF8EF]/45">
                      <td className="py-3 px-4">
                        <p className="font-mono font-bold text-[#1F1D2B]">{c.code}</p>
                        <p className="text-[11px] text-[#1F1D2B]/60">{c.description}</p>
                      </td>
                      <td className="py-3 px-4 font-heading font-bold text-[#FF7A00] tabular-nums">
                        {c.type === 'percentage' ? `${c.value}% OFF` : `${formatINR(c.value)} OFF`}
                      </td>
                      <td className="py-3 px-4 text-[#1F1D2B]/75 tabular-nums">
                        Min {formatINR(c.minOrderValue)}
                        {c.maxDiscount > 0 ? ` · Max ${formatINR(c.maxDiscount)}` : ''}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold tabular-nums">
                        {c.usedCount} / {c.usageLimit === 0 ? '∞' : c.usageLimit}
                      </td>
                      <td className="py-3 px-4 tabular-nums text-[#1F1D2B]/70 whitespace-nowrap">
                        {new Date(c.startDate).toLocaleDateString('en-IN', {
                          timeZone: REPORTING_TIMEZONE,
                        })}{' '}
                        →{' '}
                        {new Date(c.expiryDate).toLocaleDateString('en-IN', {
                          timeZone: REPORTING_TIMEZONE,
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <ProductBadge
                          tone={
                            !c.active || isExpired || limitReached ? 'error' : 'success'
                          }
                        >
                          {!c.active
                            ? 'INACTIVE'
                            : isExpired
                              ? 'EXPIRED'
                              : limitReached
                                ? 'LIMIT HIT'
                                : 'ACTIVE'}
                        </ProductBadge>
                      </td>
                      {canManage && (
                        <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                          <button
                            type="button"
                            onClick={() => void handleToggleActive(c)}
                            className="text-xs font-semibold text-[#1F1D2B]/75 hover:text-[#FF7A00] cursor-pointer"
                          >
                            {c.active ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            type="button"
                            onClick={() => loadForEdit(c)}
                            aria-label={`Edit ${c.code}`}
                            className="inline-flex p-1.5 rounded-lg border border-[#1F1D2B]/15 hover:border-[#FF7A00] cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(c.code)}
                            aria-label={`Delete ${c.code}`}
                            className="inline-flex p-1.5 rounded-lg border border-[#DC2626]/20 text-[#DC2626] hover:bg-[#DC2626]/10 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Live Server-Side Coupon Validator Tester */}
      <form
        onSubmit={handleTestValidation}
        className="rounded-2xl border border-[#1F1D2B]/12 bg-white p-5 space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-heading text-sm font-bold text-[#1F1D2B] flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-[#16A34A]" />
              Server-Side Coupon Validation Tester
            </h3>
            <p className="text-xs text-[#1F1D2B]/60">
              Verifies coupon rules via <code className="font-mono">POST /api/admin/coupons/validate</code>.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Coupon Code (e.g. JUMMO10)"
            value={testCode}
            onChange={(e) => setTestCode(e.target.value.toUpperCase())}
            className="h-10 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3 text-xs font-mono uppercase"
          />
          <input
            type="number"
            min={1}
            placeholder="Order Subtotal (₹)"
            value={testSubtotal}
            onChange={(e) => setTestSubtotal(e.target.value)}
            className="h-10 w-44 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3 text-xs tabular-nums"
          />
          <Button type="submit" variant="secondary" size="sm" disabled={testing}>
            {testing ? 'Validating...' : 'Test on Server'}
          </Button>
        </div>

        {testResult && (
          <div
            className={`rounded-xl border p-3 text-xs flex items-center gap-2 ${
              testResult.valid
                ? 'border-[#16A34A]/30 bg-[#16A34A]/10 text-[#1F1D2B]'
                : 'border-[#DC2626]/30 bg-[#DC2626]/8 text-[#DC2626]'
            }`}
          >
            {testResult.valid ? (
              <CheckCircle2 className="h-4 w-4 text-[#16A34A] shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-[#DC2626] shrink-0" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}
      </form>

      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteCoupon()}
        title={`Delete Coupon ${deleteTarget || ''}?`}
        message="This permanently removes the coupon from Cloud Firestore. Past orders retain their historical discount snapshots."
        confirmLabel={deleting ? 'Deleting...' : 'Delete Coupon'}
        destructive
      />
    </div>
  );
};
