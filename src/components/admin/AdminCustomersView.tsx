import React, { useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Eye,
  Flag,
  Loader2,
  MessageSquarePlus,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  addCustomerSupportNoteApi,
  updateCustomerStatusApi,
} from '../../services/adminApi';
import type {
  CustomerAccountStatus,
  CustomerRecordDoc,
} from '../../types/admin';
import type { OrderDoc } from '../../types/commerce';
import { REPORTING_TIMEZONE } from '../../utils/adminAnalytics';
import { maskEmailForRole, maskPhoneForRole } from '../../utils/adminPermissions';
import { formatINR } from '../../utils/catalogHelpers';
import { useToast } from '../ui/Overlays';
import { Button, ProductBadge, SearchBar, StatusAlert } from '../ui/Primitives';

interface AdminCustomersViewProps {
  customers: CustomerRecordDoc[];
  orders: OrderDoc[];
}

interface EnrichedCustomer {
  profile: CustomerRecordDoc;
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  totalSpent: number;
  lastOrderAt: string | null;
  recentOrders: OrderDoc[];
  primaryAddress: string;
}

const PAGE_SIZE = 15;

export const AdminCustomersView: React.FC<AdminCustomersViewProps> = ({
  customers,
  orders,
}) => {
  const { user, hasPermission } = useAuth();
  const { addToast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CustomerAccountStatus>('all');
  const [page, setPage] = useState(1);

  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [nextAccountStatus, setNextAccountStatus] = useState<CustomerAccountStatus>('active');
  const [statusReason, setStatusReason] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);

  const [supportSubject, setSupportSubject] = useState('');
  const [supportSummary, setSupportSummary] = useState('');
  const [supportStatus, setSupportStatus] = useState<'open' | 'resolved'>('open');
  const [supportBusy, setSupportBusy] = useState(false);

  const canViewPii = hasPermission('customers:pii');
  const canManageCustomers = hasPermission('customers:manage');

  const enrichedCustomers = useMemo<EnrichedCustomer[]>(() => {
    const ordersByUid = new Map<string, OrderDoc[]>();
    for (const order of orders) {
      if (!order.customerUid) continue;
      const list = ordersByUid.get(order.customerUid) || [];
      list.push(order);
      ordersByUid.set(order.customerUid, list);
    }

    const customerMap = new Map<string, CustomerRecordDoc>();
    for (const c of customers) {
      if (c.role === 'customer' || !c.role) {
        customerMap.set(c.uid, c);
      }
    }

    // Ensure customers who placed orders are represented even if user profile sync lagged
    for (const [uid, list] of ordersByUid.entries()) {
      if (!customerMap.has(uid) && list[0]) {
        customerMap.set(uid, {
          uid,
          displayName: list[0].customerName || 'Store Customer',
          email: list[0].customerEmail || '',
          phone: list[0].customerPhone || '',
          photoURL: '',
          role: 'customer',
          accountStatus: 'active',
          supportNotes: [],
          createdAt: list[list.length - 1]?.createdAt || new Date().toISOString(),
          updatedAt: list[0].updatedAt,
        });
      }
    }

    const rows: EnrichedCustomer[] = [];
    for (const profile of customerMap.values()) {
      const custOrders = (ordersByUid.get(profile.uid) || []).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );
      let totalSpent = 0;
      let deliveredOrders = 0;
      let cancelledOrders = 0;
      for (const o of custOrders) {
        if (o.orderStatus === 'Delivered') deliveredOrders += 1;
        if (o.orderStatus === 'Cancelled') {
          cancelledOrders += 1;
        } else {
          totalSpent += Number(o.totalAmount || 0);
        }
      }
      const latestAddr = custOrders[0]?.deliveryAddress;
      const primaryAddress = latestAddr
        ? `${latestAddr.city}, ${latestAddr.state} - ${latestAddr.pinCode}`
        : 'No delivery address yet';

      rows.push({
        profile,
        totalOrders: custOrders.length,
        deliveredOrders,
        cancelledOrders,
        totalSpent,
        lastOrderAt: custOrders[0]?.createdAt || null,
        recentOrders: custOrders,
        primaryAddress,
      });
    }

    return rows.sort((a, b) => b.totalSpent - a.totalSpent || b.totalOrders - a.totalOrders);
  }, [customers, orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enrichedCustomers.filter((c) => {
      if (statusFilter !== 'all' && c.profile.accountStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        c.profile.displayName.toLowerCase().includes(q) ||
        c.profile.email.toLowerCase().includes(q) ||
        c.profile.phone.toLowerCase().includes(q) ||
        c.profile.uid.toLowerCase().includes(q) ||
        c.primaryAddress.toLowerCase().includes(q)
      );
    });
  }, [enrichedCustomers, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  const selectedCustomer = useMemo(
    () => enrichedCustomers.find((c) => c.profile.uid === selectedUid) || null,
    [enrichedCustomers, selectedUid]
  );

  const openCustomerDrawer = (entry: EnrichedCustomer) => {
    setSelectedUid(entry.profile.uid);
    setNextAccountStatus(entry.profile.accountStatus);
    setStatusReason('');
    setSupportSubject('');
    setSupportSummary('');
    setSupportStatus('open');
  };

  const handleUpdateAccountStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || statusBusy) return;
    setStatusBusy(true);
    try {
      await updateCustomerStatusApi(
        user,
        selectedCustomer.profile.uid,
        nextAccountStatus,
        statusReason.trim() || 'Admin account status review'
      );
      setStatusReason('');
      addToast({
        type: 'success',
        title: 'Customer Status Updated',
        description: `Account status changed to ${nextAccountStatus}.`,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Update Failed',
        description: err instanceof Error ? err.message : 'Unable to update customer status.',
      });
    } finally {
      setStatusBusy(false);
    }
  };

  const handleAddSupportEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || supportBusy) return;
    if (supportSubject.trim().length < 2 || supportSummary.trim().length < 2) {
      addToast({
        type: 'error',
        title: 'Incomplete Support Note',
        description: 'Enter both a subject and support summary.',
      });
      return;
    }
    setSupportBusy(true);
    try {
      await addCustomerSupportNoteApi(user, selectedCustomer.profile.uid, {
        subject: supportSubject.trim(),
        summary: supportSummary.trim(),
        status: supportStatus,
      });
      setSupportSubject('');
      setSupportSummary('');
      addToast({
        type: 'success',
        title: 'Support Entry Recorded',
        description: 'Logged customer support record to Cloud Firestore.',
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Failed to Log Support Note',
        description: err instanceof Error ? err.message : 'Unable to save support record.',
      });
    } finally {
      setSupportBusy(false);
    }
  };

  const accountStatusTone = (status: CustomerAccountStatus) => {
    if (status === 'active') return 'success' as const;
    if (status === 'flagged') return 'warning' as const;
    return 'error' as const;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#FF7A00]">
            Customer Directory · Privacy-Scoped Access
          </p>
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-[#1F1D2B]">
            Customers Management ({filtered.length})
          </h2>
          <p className="text-xs text-[#1F1D2B]/65 mt-0.5">
            Inspect verified customer profiles, lifetime purchase values, order history, support
            records, and account status controls.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-xl border border-[#1F1D2B]/12 bg-white px-3 py-2 text-xs">
          <ShieldCheck className="h-4 w-4 text-[#16A34A]" />
          <span className="font-semibold text-[#1F1D2B]">
            {canViewPii ? 'Full PII Authorized' : 'Masked PII Mode (Role-Scoped)'}
          </span>
        </div>
      </div>

      {!canViewPii && (
        <StatusAlert
          variant="info"
          title="Role-Scoped Privacy Protection Active"
          description="Your role hides raw customer emails and phone numbers to protect personal data. Super Admin and Admin roles have full support access."
        />
      )}

      {/* Search & Status Filters */}
      <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="w-full md:w-96">
          <SearchBar
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search customer name, email, city, or UID..."
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['all', 'active', 'flagged', 'suspended'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize cursor-pointer ${
                statusFilter === st
                  ? 'bg-[#1F1D2B] text-[#FFF8EF]'
                  : 'bg-[#FFF8EF] text-[#1F1D2B]/75 hover:text-[#1F1D2B]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Customers Table */}
      <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white overflow-hidden">
        {paginated.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Users className="h-8 w-8 mx-auto text-[#1F1D2B]/30" />
            <p className="font-heading text-sm font-bold text-[#1F1D2B]">
              No matching customers found
            </p>
            <p className="text-xs text-[#1F1D2B]/55">
              Registered customers and checkout buyers appear here automatically from Firestore.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#1F1D2B]/10 bg-[#FFF8EF]/70 text-[#1F1D2B]/60">
                    <th className="py-3 px-4 font-semibold">Customer</th>
                    <th className="py-3 px-4 font-semibold">Contact</th>
                    <th className="py-3 px-4 font-semibold">Location</th>
                    <th className="py-3 px-4 font-semibold text-right">Orders</th>
                    <th className="py-3 px-4 font-semibold text-right">Lifetime Value</th>
                    <th className="py-3 px-4 font-semibold">Account Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F1D2B]/8">
                  {paginated.map((entry) => (
                    <tr key={entry.profile.uid} className="hover:bg-[#FFF8EF]/45">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-[#1F1D2B]">{entry.profile.displayName}</p>
                        <p className="font-mono text-[10px] text-[#1F1D2B]/50">
                          {entry.profile.uid.slice(0, 14)}…
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-[#1F1D2B]/85">
                          {maskEmailForRole(entry.profile.email, canViewPii) || '—'}
                        </p>
                        <p className="text-[11px] text-[#1F1D2B]/55 tabular-nums">
                          {maskPhoneForRole(entry.profile.phone, canViewPii) || 'No phone'}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-[#1F1D2B]/75">{entry.primaryAddress}</td>
                      <td className="py-3 px-4 text-right font-semibold tabular-nums">
                        {entry.totalOrders}
                      </td>
                      <td className="py-3 px-4 text-right font-heading font-bold text-[#1F1D2B] tabular-nums">
                        {formatINR(entry.totalSpent)}
                      </td>
                      <td className="py-3 px-4">
                        <ProductBadge tone={accountStatusTone(entry.profile.accountStatus)}>
                          {entry.profile.accountStatus.toUpperCase()}
                        </ProductBadge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openCustomerDrawer(entry)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#1F1D2B]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#1F1D2B] hover:border-[#FF7A00] hover:text-[#FF7A00] cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Profile
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
                  Page {page} of {totalPages}
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

      {/* Customer Profile Drawer */}
      {selectedCustomer && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[#1F1D2B]/65 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label={`Customer ${selectedCustomer.profile.displayName}`}
        >
          <div className="w-full max-w-2xl h-full overflow-y-auto bg-white p-6 shadow-2xl space-y-6">
            <div className="flex items-start justify-between gap-3 border-b border-[#1F1D2B]/10 pb-4">
              <div>
                <p className="text-xs font-semibold text-[#FF7A00] font-mono">
                  UID: {selectedCustomer.profile.uid}
                </p>
                <h3 className="font-heading text-xl font-bold text-[#1F1D2B]">
                  {selectedCustomer.profile.displayName}
                </h3>
                <p className="text-xs text-[#1F1D2B]/65 mt-0.5">
                  {maskEmailForRole(selectedCustomer.profile.email, canViewPii)} ·{' '}
                  {maskPhoneForRole(selectedCustomer.profile.phone, canViewPii) || 'No phone'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUid(null)}
                aria-label="Close customer profile"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#1F1D2B]/15 text-[#1F1D2B] hover:border-[#FF7A00] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Summary Metrics */}
            <div className="grid grid-cols-3 gap-3 text-xs tabular-nums">
              <div className="rounded-xl border border-[#1F1D2B]/10 bg-[#FFF8EF]/60 p-3">
                <p className="text-[#1F1D2B]/60">Total Orders</p>
                <p className="mt-1 font-heading text-lg font-bold text-[#1F1D2B]">
                  {selectedCustomer.totalOrders}
                </p>
              </div>
              <div className="rounded-xl border border-[#1F1D2B]/10 bg-[#FFF8EF]/60 p-3">
                <p className="text-[#1F1D2B]/60">Delivered</p>
                <p className="mt-1 font-heading text-lg font-bold text-[#16A34A]">
                  {selectedCustomer.deliveredOrders}
                </p>
              </div>
              <div className="rounded-xl border border-[#1F1D2B]/10 bg-[#FFF8EF]/60 p-3">
                <p className="text-[#1F1D2B]/60">Lifetime Spend</p>
                <p className="mt-1 font-heading text-lg font-bold text-[#FF7A00]">
                  {formatINR(selectedCustomer.totalSpent)}
                </p>
              </div>
            </div>

            {/* Account Status Management */}
            {canManageCustomers && (
              <form
                onSubmit={handleUpdateAccountStatus}
                className="rounded-2xl border border-[#1F1D2B]/12 bg-[#FFF8EF]/60 p-4 space-y-3"
              >
                <h4 className="font-heading text-sm font-bold text-[#1F1D2B]">
                  Account Status Control
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={nextAccountStatus}
                    onChange={(e) => setNextAccountStatus(e.target.value as CustomerAccountStatus)}
                    className="h-10 rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-xs font-semibold text-[#1F1D2B]"
                  >
                    <option value="active">Active (Normal Shopping)</option>
                    <option value="flagged">Flagged (Review Required)</option>
                    <option value="suspended">Suspended (Blocked)</option>
                  </select>
                  <input
                    type="text"
                    maxLength={240}
                    placeholder="Audit reason (optional)"
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    className="h-10 rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-xs"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    disabled={statusBusy}
                    leftIcon={
                      statusBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : nextAccountStatus === 'active' ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : nextAccountStatus === 'flagged' ? (
                        <Flag className="h-3.5 w-3.5" />
                      ) : (
                        <Ban className="h-3.5 w-3.5" />
                      )
                    }
                  >
                    {statusBusy ? 'Saving...' : 'Save Account Status'}
                  </Button>
                </div>
              </form>
            )}

            {/* Order History */}
            <div className="space-y-2">
              <h4 className="font-heading text-sm font-bold text-[#1F1D2B]">
                Order History ({selectedCustomer.recentOrders.length})
              </h4>
              {selectedCustomer.recentOrders.length === 0 ? (
                <p className="text-xs text-[#1F1D2B]/55">No orders placed by this customer yet.</p>
              ) : (
                <div className="divide-y divide-[#1F1D2B]/10 rounded-xl border border-[#1F1D2B]/10">
                  {selectedCustomer.recentOrders.slice(0, 10).map((ord) => (
                    <div
                      key={ord.orderId}
                      className="p-3 flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <p className="font-mono font-semibold text-[#1F1D2B]">{ord.orderId}</p>
                        <p className="text-[11px] text-[#1F1D2B]/60">
                          {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                            timeZone: REPORTING_TIMEZONE,
                          })}{' '}
                          · {ord.paymentMethod.toUpperCase()} · {ord.paymentStatus}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold tabular-nums">{formatINR(ord.totalAmount)}</p>
                        <p className="text-[11px] font-semibold text-[#FF7A00]">{ord.orderStatus}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Support History */}
            <div className="space-y-3 pb-6">
              <h4 className="font-heading text-sm font-bold text-[#1F1D2B]">
                Customer Support History ({selectedCustomer.profile.supportNotes.length})
              </h4>
              {canManageCustomers && (
                <form
                  onSubmit={handleAddSupportEntry}
                  className="rounded-xl border border-[#1F1D2B]/12 bg-[#FFF8EF]/50 p-3.5 space-y-2.5"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      required
                      maxLength={120}
                      placeholder="Support subject"
                      value={supportSubject}
                      onChange={(e) => setSupportSubject(e.target.value)}
                      className="sm:col-span-2 h-9 rounded-lg border border-[#1F1D2B]/15 bg-white px-3 text-xs"
                    />
                    <select
                      value={supportStatus}
                      onChange={(e) => setSupportStatus(e.target.value as 'open' | 'resolved')}
                      className="h-9 rounded-lg border border-[#1F1D2B]/15 bg-white px-2.5 text-xs font-semibold"
                    >
                      <option value="open">Open Ticket</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                  <textarea
                    required
                    rows={2}
                    maxLength={320}
                    placeholder="Summary of customer query or resolution..."
                    value={supportSummary}
                    onChange={(e) => setSupportSummary(e.target.value)}
                    className="w-full rounded-lg border border-[#1F1D2B]/15 bg-white p-2.5 text-xs"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={supportBusy}
                      leftIcon={<MessageSquarePlus className="h-3.5 w-3.5" />}
                    >
                      {supportBusy ? 'Logging...' : 'Log Support Entry'}
                    </Button>
                  </div>
                </form>
              )}

              {selectedCustomer.profile.supportNotes.length === 0 ? (
                <p className="text-xs text-[#1F1D2B]/55">No support tickets recorded yet.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {selectedCustomer.profile.supportNotes.map((note) => (
                    <li
                      key={note.id}
                      className="rounded-xl border border-[#1F1D2B]/10 bg-white p-3 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#1F1D2B]">{note.subject}</span>
                        <ProductBadge tone={note.status === 'resolved' ? 'success' : 'warning'}>
                          {note.status.toUpperCase()}
                        </ProductBadge>
                      </div>
                      <p className="text-[#1F1D2B]/75">{note.summary}</p>
                      <p className="text-[11px] text-[#1F1D2B]/50">
                        {note.actorName} ·{' '}
                        {new Date(note.createdAt).toLocaleString('en-IN', {
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
