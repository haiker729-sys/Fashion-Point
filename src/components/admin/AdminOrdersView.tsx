import React, { useMemo, useState } from 'react';
import {
  Clock,
  Download,
  Eye,
  FileText,
  Loader2,
  MessageSquarePlus,
  ShoppingCart,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  addOrderNoteApi,
  downloadAdminReportCsvApi,
  updateOrderStatusApi,
} from '../../services/adminApi';
import type { OrderDoc, OrderStatus } from '../../types/commerce';
import {
  REPORTING_TIMEZONE,
  resolveDateRangeWindow,
} from '../../utils/adminAnalytics';
import { formatINR } from '../../utils/catalogHelpers';
import { maskEmailForRole, maskPhoneForRole } from '../../utils/adminPermissions';
import { useToast } from '../ui/Overlays';
import { Button, ProductBadge, SearchBar } from '../ui/Primitives';

interface AdminOrdersViewProps {
  orders: OrderDoc[];
}

const ALL_ORDER_STATUSES: OrderStatus[] = [
  'Pending',
  'Confirmed',
  'Processing',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
];

const PAGE_SIZE = 15;

export const AdminOrdersView: React.FC<AdminOrdersViewProps> = ({ orders }) => {
  const { user, hasPermission } = useAuth();
  const { addToast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | OrderStatus>('All');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'online_paid' | 'cod' | 'failed_pending'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'last_7_days' | 'this_month'>('all');
  const [page, setPage] = useState(1);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState<OrderStatus>('Confirmed');
  const [statusReason, setStatusReason] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);

  const [noteInput, setNoteInput] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const canUpdateStatus = hasPermission('orders:update');
  const canAddNotes = hasPermission('orders:note');
  const canViewPii = hasPermission('customers:pii');
  const canExport = hasPermission('reports:operational') || hasPermission('reports:financial');

  const selectedOrder = useMemo(
    () => orders.find((o) => o.orderId === selectedOrderId) || null,
    [orders, selectedOrderId]
  );

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    const dateWin =
      dateFilter === 'all' ? null : resolveDateRangeWindow(dateFilter);

    return orders.filter((o) => {
      if (statusFilter !== 'All' && o.orderStatus !== statusFilter) return false;
      if (paymentFilter === 'cod' && o.paymentMethod !== 'cod') return false;
      if (
        paymentFilter === 'online_paid' &&
        (o.paymentMethod !== 'online' ||
          !['Paid', 'Payment Captured', 'Payment Verified', 'Partially Refunded', 'Refunded'].includes(
            o.paymentStatus
          ))
      ) {
        return false;
      }
      if (
        paymentFilter === 'failed_pending' &&
        !['Pending', 'Payment Processing', 'Payment Authorized', 'Failed', 'Payment Failed', 'Invalid Signature', 'Payment Verification Failed', 'COD Pending'].includes(
          o.paymentStatus
        )
      ) {
        return false;
      }

      if (dateWin) {
        const ms = Date.parse(o.createdAt) || 0;
        if (ms < dateWin.startMs || ms > dateWin.endMs) return false;
      }

      if (!q) return true;
      return (
        o.orderId.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerEmail.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q) ||
        o.items.some((item) => item.productName.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q))
      );
    });
  }, [dateFilter, orders, paymentFilter, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const paginatedOrders = useMemo(
    () => filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredOrders, page]
  );

  const statusTone = (status: OrderStatus) => {
    if (status === 'Delivered') return 'success' as const;
    if (status === 'Shipped' || status === 'Out for Delivery') return 'info' as const;
    if (status === 'Confirmed' || status === 'Processing' || status === 'Packed') return 'accent' as const;
    if (status === 'Pending') return 'warning' as const;
    return 'error' as const;
  };

  const handleOpenOrder = (order: OrderDoc) => {
    setSelectedOrderId(order.orderId);
    setNextStatus(order.orderStatus);
    setStatusReason('');
    setNoteInput('');
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || statusBusy) return;
    if (statusReason.trim().length < 3) {
      addToast({
        type: 'error',
        title: 'Audit Reason Required',
        description: 'Enter a clear status change reason (at least 3 characters).',
      });
      return;
    }
    setStatusBusy(true);
    try {
      await updateOrderStatusApi(user, selectedOrder.orderId, {
        orderStatus: nextStatus,
        reason: statusReason.trim(),
      });
      setStatusReason('');
      addToast({
        type: 'success',
        title: 'Order Status Updated',
        description: `Order ${selectedOrder.orderId} updated to "${nextStatus}".`,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Status Update Blocked',
        description: err instanceof Error ? err.message : 'Unable to update order status.',
      });
    } finally {
      setStatusBusy(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || noteBusy || !noteInput.trim()) return;
    setNoteBusy(true);
    try {
      await addOrderNoteApi(user, selectedOrder.orderId, noteInput.trim());
      setNoteInput('');
      addToast({
        type: 'success',
        title: 'Internal Note Added',
        description: `Recorded internal staff note on ${selectedOrder.orderId}.`,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Failed to Add Note',
        description: err instanceof Error ? err.message : 'Unable to add order note.',
      });
    } finally {
      setNoteBusy(false);
    }
  };

  const handleExportOrders = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await downloadAdminReportCsvApi(user, {
        reportType: 'orders',
        preset: dateFilter === 'all' ? 'last_30_days' : dateFilter,
      });
      addToast({
        type: 'success',
        title: 'Orders CSV Exported',
        description: `Downloaded ${res.filename} (${res.rowCount} rows).`,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Export Failed',
        description: err instanceof Error ? err.message : 'Unable to export orders.',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#FF7A00]">
            Fulfillment Lifecycle · Trusted Server Validation
          </p>
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-[#1F1D2B]">
            Orders Management ({filteredOrders.length})
          </h2>
          <p className="text-xs text-[#1F1D2B]/65 mt-0.5">
            Search, inspect line items, update fulfillment status with audit trail, and add internal
            notes. Online payment states remain strictly Razorpay-verified.
          </p>
        </div>

        {canExport && (
          <Button
            variant="outline"
            size="sm"
            disabled={exporting}
            leftIcon={
              exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />
            }
            onClick={() => void handleExportOrders()}
          >
            Export Orders CSV
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6">
            <SearchBar
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search Order ID, customer name, SKU, or phone..."
            />
          </div>
          <div className="md:col-span-3">
            <select
              value={paymentFilter}
              onChange={(e) => {
                setPaymentFilter(e.target.value as typeof paymentFilter);
                setPage(1);
              }}
              aria-label="Filter by payment status"
              className="w-full h-11 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3 text-xs font-semibold text-[#1F1D2B]"
            >
              <option value="all">All Payment States</option>
              <option value="online_paid">Online Verified / Paid</option>
              <option value="cod">Cash on Delivery (COD)</option>
              <option value="failed_pending">Pending / Failed Payment</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value as typeof dateFilter);
                setPage(1);
              }}
              aria-label="Filter by date window"
              className="w-full h-11 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3 text-xs font-semibold text-[#1F1D2B]"
            >
              <option value="all">All Time</option>
              <option value="today">Today (IST)</option>
              <option value="last_7_days">Last 7 Days (IST)</option>
              <option value="this_month">This Month (IST)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto fw-no-scrollbar pt-1">
          {(['All', ...ALL_ORDER_STATUSES] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setStatusFilter(status);
                setPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer ${
                statusFilter === status
                  ? 'bg-[#1F1D2B] text-[#FFF8EF]'
                  : 'bg-[#FFF8EF] text-[#1F1D2B]/75 hover:text-[#1F1D2B]'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white overflow-hidden">
        {paginatedOrders.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <ShoppingCart className="h-8 w-8 mx-auto text-[#1F1D2B]/30" />
            <p className="font-heading text-sm font-bold text-[#1F1D2B]">
              No matching orders found
            </p>
            <p className="text-xs text-[#1F1D2B]/55">
              Adjust your filters or wait for new Firestore customer checkouts.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#1F1D2B]/10 bg-[#FFF8EF]/70 text-[#1F1D2B]/60">
                    <th className="py-3 px-4 font-semibold">Order ID</th>
                    <th className="py-3 px-4 font-semibold">Customer</th>
                    <th className="py-3 px-4 font-semibold">Date (IST)</th>
                    <th className="py-3 px-4 font-semibold">Items</th>
                    <th className="py-3 px-4 font-semibold">Payment</th>
                    <th className="py-3 px-4 font-semibold text-right">Total</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F1D2B]/8">
                  {paginatedOrders.map((order) => (
                    <tr key={order.orderId} className="hover:bg-[#FFF8EF]/50">
                      <td className="py-3 px-4 font-mono font-semibold text-[#1F1D2B] whitespace-nowrap">
                        {order.orderId}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <p className="font-semibold text-[#1F1D2B]">{order.customerName}</p>
                        <p className="text-[11px] text-[#1F1D2B]/55">
                          {maskEmailForRole(order.customerEmail, canViewPii)}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-[#1F1D2B]/70 tabular-nums whitespace-nowrap">
                        {new Date(order.createdAt).toLocaleString('en-IN', {
                          timeZone: REPORTING_TIMEZONE,
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="py-3 px-4 tabular-nums whitespace-nowrap">
                        {order.items.reduce((s, i) => s + i.quantity, 0)} pc(s)
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <p className="font-semibold text-[#1F1D2B]">
                          {order.paymentMethod.toUpperCase()}
                        </p>
                        <p className="text-[11px] text-[#1F1D2B]/60">{order.paymentStatus}</p>
                      </td>
                      <td className="py-3 px-4 text-right font-heading font-bold text-[#1F1D2B] tabular-nums whitespace-nowrap">
                        {formatINR(order.totalAmount)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <ProductBadge tone={statusTone(order.orderStatus)}>
                          {order.orderStatus}
                        </ProductBadge>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenOrder(order)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#1F1D2B]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#1F1D2B] hover:border-[#FF7A00] hover:text-[#FF7A00] cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-[#1F1D2B]/10 px-4 py-3 text-xs">
                <span className="text-[#1F1D2B]/60 tabular-nums">
                  Page {page} of {totalPages} ({filteredOrders.length} orders)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Order Details Slide-Over / Modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[#1F1D2B]/65 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label={`Order ${selectedOrder.orderId} Details`}
        >
          <div className="w-full max-w-2xl h-full overflow-y-auto bg-white p-6 shadow-2xl space-y-6">
            <div className="flex items-start justify-between gap-3 border-b border-[#1F1D2B]/10 pb-4">
              <div>
                <p className="text-xs font-semibold text-[#FF7A00] font-mono">
                  {selectedOrder.orderId}
                </p>
                <h3 className="font-heading text-xl font-bold text-[#1F1D2B]">
                  {selectedOrder.customerName}
                </h3>
                <p className="text-xs text-[#1F1D2B]/60 mt-0.5 tabular-nums">
                  Placed{' '}
                  {new Date(selectedOrder.createdAt).toLocaleString('en-IN', {
                    timeZone: REPORTING_TIMEZONE,
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderId(null)}
                aria-label="Close order details"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#1F1D2B]/15 text-[#1F1D2B] hover:border-[#FF7A00] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Order Financial & Shipping Meta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="rounded-xl border border-[#1F1D2B]/10 bg-[#FFF8EF]/60 p-4 space-y-1.5">
                <p className="font-bold text-[#1F1D2B] uppercase tracking-wider text-[11px]">
                  Customer &amp; Delivery
                </p>
                <p className="font-semibold text-[#1F1D2B]">
                  {selectedOrder.deliveryAddress.fullName}
                </p>
                <p className="text-[#1F1D2B]/75">
                  {maskEmailForRole(selectedOrder.customerEmail, canViewPii)} ·{' '}
                  {maskPhoneForRole(selectedOrder.customerPhone, canViewPii)}
                </p>
                <p className="text-[#1F1D2B]/75">
                  {selectedOrder.deliveryAddress.houseFlat},{' '}
                  {selectedOrder.deliveryAddress.streetArea}, {selectedOrder.deliveryAddress.city},{' '}
                  {selectedOrder.deliveryAddress.state} - {selectedOrder.deliveryAddress.pinCode}
                </p>
              </div>

              <div className="rounded-xl border border-[#1F1D2B]/10 bg-[#FFF8EF]/60 p-4 space-y-1.5 tabular-nums">
                <p className="font-bold text-[#1F1D2B] uppercase tracking-wider text-[11px]">
                  Payment &amp; Totals
                </p>
                <p>
                  Method: <strong>{selectedOrder.paymentMethod.toUpperCase()}</strong> · Status:{' '}
                  <strong>{selectedOrder.paymentStatus}</strong>
                </p>
                {selectedOrder.razorpayOrderId && (
                  <p className="font-mono text-[11px] text-[#1F1D2B]/70">
                    Razorpay Order: {selectedOrder.razorpayOrderId}
                  </p>
                )}
                <p>
                  Subtotal {formatINR(selectedOrder.subtotal)} − Discount{' '}
                  {formatINR(selectedOrder.discount)} + Delivery{' '}
                  {formatINR(selectedOrder.deliveryCharge)} ={' '}
                  <strong className="text-[#FF7A00] text-sm">
                    {formatINR(selectedOrder.totalAmount)}
                  </strong>
                </p>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <h4 className="font-heading text-sm font-bold text-[#1F1D2B]">
                Ordered Items ({selectedOrder.items.length})
              </h4>
              <div className="divide-y divide-[#1F1D2B]/10 rounded-xl border border-[#1F1D2B]/10">
                {selectedOrder.items.map((item, i) => (
                  <div key={`${item.sku}-${i}`} className="p-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-semibold text-[#1F1D2B]">{item.productName}</p>
                      <p className="text-[#1F1D2B]/60 font-mono text-[11px]">
                        {item.sku} · {item.selectedColour} · Size {item.selectedSize} × {item.quantity}
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums">{formatINR(item.lineTotal)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Trusted Order Status Update Form */}
            {canUpdateStatus && (
              <form
                onSubmit={handleStatusSubmit}
                className="rounded-2xl border border-[#1F1D2B]/12 bg-[#FFF8EF]/60 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-heading text-sm font-bold text-[#1F1D2B]">
                    Update Fulfillment Status
                  </h4>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#16A34A]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Online Payment Lock Enforced
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={nextStatus}
                    onChange={(e) => setNextStatus(e.target.value as OrderStatus)}
                    className="h-10 rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-xs font-semibold text-[#1F1D2B]"
                  >
                    {ALL_ORDER_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={280}
                    placeholder="Audit reason (e.g. Dispatched via BlueDart)"
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    className="h-10 rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-xs"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-[#1F1D2B]/60">
                    Online orders require gateway verification before shipping. Manual online payment overrides are blocked.
                  </p>
                  <Button type="submit" variant="primary" size="sm" disabled={statusBusy}>
                    {statusBusy ? 'Saving...' : 'Update Status'}
                  </Button>
                </div>
              </form>
            )}

            {/* Internal Staff Notes */}
            <div className="space-y-3">
              <h4 className="font-heading text-sm font-bold text-[#1F1D2B] flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-[#FF7A00]" />
                Internal Staff Notes ({selectedOrder.internalNotes?.length || 0})
              </h4>
              {canAddNotes && (
                <form onSubmit={handleAddNote} className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={360}
                    placeholder="Add internal operational or courier note..."
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    className="flex-1 h-10 rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-xs"
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    disabled={noteBusy}
                    leftIcon={<MessageSquarePlus className="h-3.5 w-3.5" />}
                  >
                    Add Note
                  </Button>
                </form>
              )}
              {(selectedOrder.internalNotes || []).length === 0 ? (
                <p className="text-xs text-[#1F1D2B]/55">No internal notes recorded yet.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {(selectedOrder.internalNotes || []).map((n) => (
                    <li
                      key={n.id}
                      className="rounded-xl border border-[#1F1D2B]/10 bg-[#FFF8EF]/50 p-3 space-y-1"
                    >
                      <p className="text-[#1F1D2B] font-medium">{n.text}</p>
                      <p className="text-[11px] text-[#1F1D2B]/55">
                        {n.authorName} ({n.authorRole.replace('_', ' ')}) ·{' '}
                        {new Date(n.createdAt).toLocaleString('en-IN', {
                          timeZone: REPORTING_TIMEZONE,
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Order Status Timeline */}
            <div className="space-y-3 pb-4">
              <h4 className="font-heading text-sm font-bold text-[#1F1D2B] flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-[#2563EB]" />
                Order Audit Timeline ({selectedOrder.statusHistory?.length || 0})
              </h4>
              {(selectedOrder.statusHistory || []).length === 0 ? (
                <p className="text-xs text-[#1F1D2B]/55">
                  Initial status: {selectedOrder.orderStatus} (awaiting status transitions).
                </p>
              ) : (
                <ul className="space-y-2 text-xs border-l-2 border-[#1F1D2B]/15 pl-4">
                  {(selectedOrder.statusHistory || []).map((ev, idx) => (
                    <li key={`${ev.timestamp}-${idx}`} className="space-y-0.5">
                      <p className="font-semibold text-[#1F1D2B]">
                        {ev.previousStatus} → {ev.status}
                      </p>
                      <p className="text-[#1F1D2B]/75">{ev.reason}</p>
                      <p className="text-[11px] text-[#1F1D2B]/50">
                        {ev.actorName} ({ev.actorRole.replace('_', ' ')}) ·{' '}
                        {new Date(ev.timestamp).toLocaleString('en-IN', {
                          timeZone: REPORTING_TIMEZONE,
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
