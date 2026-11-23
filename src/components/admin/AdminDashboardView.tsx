import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Bell,
  Box,
  CheckCheck,
  CreditCard,
  FileSpreadsheet,
  FolderTree,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  RotateCcw,
  Settings,
  Shield,
  ShoppingCart,
  Tag,
  Users,
  Warehouse,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCatalog } from '../../context/CatalogContext';
import {
  markAdminNotificationRead,
  subscribeActivityLogs,
  subscribeAdminNotifications,
  subscribeAllAdminOrders,
  subscribeAllCoupons,
  subscribeAllCustomers,
  subscribeInventoryHistory,
  subscribeShowroomSections,
  subscribeStaffMembers,
} from '../../firebase/adminData';
import type { ShowroomSectionConfigDoc } from '../../firebase/firestore';
import { subscribeAdminPaymentPreparation } from '../../firebase/payments';
import type {
  ActivityLogDoc,
  AdminDashboardSection,
  AdminNotificationDoc,
  CustomerRecordDoc,
  InventoryMovementDoc,
  StaffMemberDoc,
} from '../../types/admin';
import type { CouponDoc, OrderDoc } from '../../types/commerce';
import {
  isPaymentFailureStatus,
  type PaymentRecordDoc,
  type RefundRecordDoc,
} from '../../types/payment';
import { REPORTING_TIMEZONE } from '../../utils/adminAnalytics';
import {
  STAFF_ROLE_META,
  type AdminPermission,
  type StaffRole,
} from '../../utils/adminPermissions';
import { BrandLogo } from '../ui/BrandLogo';
import { ProductBadge, StatusAlert } from '../ui/Primitives';
import { AdminActivityLogsView } from './AdminActivityLogsView';
import { AdminAnalyticsView } from './AdminAnalyticsView';
import { AdminAuthGate } from './AdminAuthGate';
import { AdminCategoriesView } from './AdminCategoriesView';
import { AdminCouponsView } from './AdminCouponsView';
import { AdminCustomersView } from './AdminCustomersView';
import { AdminDatabaseMonitor } from './AdminDatabaseMonitor';
import { AdminInventoryView } from './AdminInventoryView';
import { AdminOrdersView } from './AdminOrdersView';
import { AdminOverviewSection } from './AdminOverviewSection';
import { AdminPaymentsRefundsView } from './AdminPaymentsRefundsView';
import { AdminProductForm } from './AdminProductForm';
import { AdminProductsView } from './AdminProductsView';
import { AdminReportsView } from './AdminReportsView';
import { AdminShowroomControlView } from './AdminShowroomControlView';
import { AdminStaffRolesView } from './AdminStaffRolesView';

interface AdminDashboardViewProps {
  onSwitchToStorefront: () => void;
}

interface SidebarNavItem {
  id: AdminDashboardSection;
  label: string;
  icon: React.FC<{ className?: string }>;
  requiredAnyPermissions: AdminPermission[];
}

const PHASE8_SIDEBAR_ITEMS: SidebarNavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    requiredAnyPermissions: ['dashboard:view'],
  },
  {
    id: 'analytics',
    label: 'Sales Analytics',
    icon: BarChart3,
    requiredAnyPermissions: ['analytics:view'],
  },
  {
    id: 'orders',
    label: 'Orders',
    icon: ShoppingCart,
    requiredAnyPermissions: ['orders:view'],
  },
  {
    id: 'payments',
    label: 'Payments',
    icon: CreditCard,
    requiredAnyPermissions: ['payments:view'],
  },
  {
    id: 'refunds',
    label: 'Refunds',
    icon: RotateCcw,
    requiredAnyPermissions: ['refunds:view'],
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: Users,
    requiredAnyPermissions: ['customers:view'],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Warehouse,
    requiredAnyPermissions: ['inventory:view'],
  },
  {
    id: 'products',
    label: 'Products',
    icon: Package,
    requiredAnyPermissions: ['products:view'],
  },
  {
    id: 'categories',
    label: 'Categories',
    icon: FolderTree,
    requiredAnyPermissions: ['categories:manage'],
  },
  {
    id: 'offers',
    label: 'Offers & Coupons',
    icon: Tag,
    requiredAnyPermissions: ['coupons:view', 'coupons:manage'],
  },
  {
    id: 'staff',
    label: 'Staff & Roles',
    icon: Shield,
    requiredAnyPermissions: ['staff:view', 'staff:manage'],
  },
  {
    id: 'showroom',
    label: '3D Showroom',
    icon: Box,
    requiredAnyPermissions: ['showroom:view', 'showroom:manage'],
  },
  {
    id: 'reports',
    label: 'Reports & CSV',
    icon: FileSpreadsheet,
    requiredAnyPermissions: ['reports:financial', 'reports:operational'],
  },
  {
    id: 'activity',
    label: 'Activity Logs',
    icon: History,
    requiredAnyPermissions: ['activity:view'],
  },
  {
    id: 'settings',
    label: 'Settings & DB',
    icon: Settings,
    requiredAnyPermissions: ['settings:manage'],
  },
];

const AdminDashboardContent: React.FC<AdminDashboardViewProps> = ({
  onSwitchToStorefront,
}) => {
  const { user, role, isAdmin, isStaff, hasPermission, logout } = useAuth();
  const { products, categories, monitor, getProductByIdOrSlug } = useCatalog();

  const [activeSection, setActiveSection] = useState<AdminDashboardSection>('dashboard');
  const [productSubView, setProductSubView] = useState<'all' | 'add' | 'edit'>('all');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Live Real-Time Firestore Collections (Zero Fake Data)
  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [payments, setPayments] = useState<PaymentRecordDoc[]>([]);
  const [refunds, setRefunds] = useState<RefundRecordDoc[]>([]);
  const [customers, setCustomers] = useState<CustomerRecordDoc[]>([]);
  const [coupons, setCoupons] = useState<CouponDoc[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMemberDoc[]>([]);
  const [inventoryHistory, setInventoryHistory] = useState<InventoryMovementDoc[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogDoc[]>([]);
  const [storedNotifications, setStoredNotifications] = useState<AdminNotificationDoc[]>([]);
  const [showroomSections, setShowroomSections] = useState<ShowroomSectionConfigDoc[]>([]);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);

  const isFinancialViewer =
    role === 'super_admin' || role === 'admin' || role === 'accountant';
  const isManagerOrAbove =
    role === 'super_admin' || role === 'admin' || role === 'manager';

  // Attach role-matched real-time Firestore listeners (zero permission errors for restricted roles)
  useEffect(() => {
    if (!isStaff) return;
    setSyncWarning(null);
    const unsubs: Array<() => void> = [];
    const onSubError = (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Firestore real-time listener error.';
      setSyncWarning(msg);
    };

    unsubs.push(subscribeAllAdminOrders(setOrders, onSubError));
    unsubs.push(subscribeInventoryHistory(setInventoryHistory, onSubError));
    unsubs.push(subscribeActivityLogs(setActivityLogs, onSubError));
    unsubs.push(subscribeAdminNotifications(setStoredNotifications, onSubError));
    unsubs.push(subscribeShowroomSections(setShowroomSections, onSubError));

    if (isFinancialViewer) {
      unsubs.push(
        subscribeAdminPaymentPreparation(true, (metrics) => {
          setPayments(metrics.payments);
          setRefunds(metrics.refunds);
        })
      );
    } else {
      setPayments([]);
      setRefunds([]);
    }

    if (isManagerOrAbove) {
      unsubs.push(subscribeAllCustomers(setCustomers, onSubError));
      unsubs.push(subscribeAllCoupons(setCoupons, onSubError));
    } else {
      setCustomers([]);
      setCoupons([]);
    }

    if (isAdmin) {
      unsubs.push(subscribeStaffMembers(setStaffMembers, onSubError));
    } else {
      setStaffMembers([]);
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [isAdmin, isFinancialViewer, isManagerOrAbove, isStaff]);

  const visibleNavItems = useMemo(
    () =>
      PHASE8_SIDEBAR_ITEMS.filter((item) =>
        item.requiredAnyPermissions.some((perm) => hasPermission(perm))
      ),
    [hasPermission]
  );

  // If role lacks access to currently selected section, return safely to dashboard
  useEffect(() => {
    if (visibleNavItems.length > 0 && !visibleNavItems.some((n) => n.id === activeSection)) {
      setActiveSection(visibleNavItems[0].id);
    }
  }, [activeSection, visibleNavItems]);

  // Combine persisted Firestore adminNotifications with derived live operational alerts (real data only)
  const combinedNotifications = useMemo<AdminNotificationDoc[]>(() => {
    const derived: AdminNotificationDoc[] = [];

    for (const p of products) {
      if (p.stockStatus === 'out_of_stock') {
        derived.push({
          notificationId: `derived-oos-${p.id}`,
          type: 'out_of_stock',
          severity: 'error',
          title: `Out of Stock: ${p.name}`,
          message: `SKU ${p.sku} has 0 units across all variants.`,
          entityId: p.id,
          readBy: [],
          createdAt: p.updatedAt,
          updatedAt: p.updatedAt,
          derived: true,
        });
      } else if (p.stockStatus === 'low_stock') {
        derived.push({
          notificationId: `derived-low-${p.id}`,
          type: 'low_stock',
          severity: 'warning',
          title: `Low Stock: ${p.name}`,
          message: `Only ${p.totalStock} unit(s) remaining on ${p.sku}.`,
          entityId: p.id,
          readBy: [],
          createdAt: p.updatedAt,
          updatedAt: p.updatedAt,
          derived: true,
        });
      }
    }

    for (const pay of payments.slice(0, 15)) {
      if (isPaymentFailureStatus(pay.paymentStatus)) {
        derived.push({
          notificationId: `derived-payfail-${pay.paymentId}`,
          type: 'payment_failed',
          severity: 'error',
          title: `Payment Failed on ${pay.orderId}`,
          message: pay.failureReason || `Status: ${pay.paymentStatus}`,
          entityId: pay.orderId,
          readBy: [],
          createdAt: pay.updatedAt,
          updatedAt: pay.updatedAt,
          derived: true,
        });
      }
    }

    return [...storedNotifications, ...derived.slice(0, 10)].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }, [payments, products, storedNotifications]);

  const unreadCount = useMemo(() => {
    const uid = user?.uid || '';
    return combinedNotifications.filter((n) => !n.readBy.includes(uid)).length;
  }, [combinedNotifications, user?.uid]);

  const handleMarkRead = async (notification: AdminNotificationDoc) => {
    if (notification.derived || !user?.uid) return;
    if (notification.readBy.includes(user.uid)) return;
    try {
      await markAdminNotificationRead(notification.notificationId, user.uid);
    } catch {
      // Non-fatal
    }
  };

  const openAddProduct = () => {
    setEditingProductId(null);
    setProductSubView('add');
    setActiveSection('products');
  };

  const openEditProduct = (productId: string) => {
    setEditingProductId(productId);
    setProductSubView('edit');
    setActiveSection('products');
  };

  const activeNavMeta =
    PHASE8_SIDEBAR_ITEMS.find((i) => i.id === activeSection) || PHASE8_SIDEBAR_ITEMS[0];

  const roleMeta = STAFF_ROLE_META[role as StaffRole];

  const renderSidebarNav = () => (
    <div className="flex h-full flex-col bg-[#1F1D2B] text-[#FFF8EF]">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <BrandLogo variant="dark" compact onClick={onSwitchToStorefront} />
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Close admin navigation"
          className="flex lg:hidden h-8 w-8 items-center justify-center rounded-lg border border-white/15 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold text-[#FFA94D]">Super Admin Console</p>
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-[#FFF8EF]/80">
          {roleMeta?.label || role}
        </span>
      </div>

      <nav
        aria-label="Admin dashboard navigation"
        className="flex-1 overflow-y-auto px-3 pb-4 space-y-1"
      >
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveSection(item.id);
                if (item.id === 'products') setProductSubView('all');
                setMobileSidebarOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#FF7A00] text-white font-semibold'
                  : 'text-[#FFF8EF]/78 hover:bg-white/8 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <button
          type="button"
          onClick={onSwitchToStorefront}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/6 px-3.5 py-2.5 text-xs font-semibold text-[#FFF8EF] hover:border-[#FFA94D] hover:text-[#FFA94D] transition-colors cursor-pointer"
        >
          View Customer Storefront
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FFF8EF] text-[#1F1D2B] flex">
      {/* Desktop Fixed Sidebar (260px) */}
      <aside className="hidden lg:block w-[260px] shrink-0 border-r border-[#1F1D2B]/12">
        <div className="sticky top-0 h-screen">{renderSidebarNav()}</div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Admin Sidebar"
        >
          <div
            className="fixed inset-0 bg-[#1F1D2B]/65 backdrop-blur-xs"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="relative z-10 h-full w-[260px] shadow-2xl">{renderSidebarNav()}</aside>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Admin Header Bar */}
        <header className="sticky top-0 z-20 border-b border-[#1F1D2B]/10 bg-white/95 backdrop-blur-md">
          <div className="flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 h-16">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                aria-label="Open admin sidebar"
                className="flex lg:hidden h-10 w-10 items-center justify-center rounded-xl border border-[#1F1D2B]/12 text-[#1F1D2B] cursor-pointer"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="text-xs text-[#1F1D2B]/55 truncate">
                  Super Admin /{' '}
                  <span className="font-semibold text-[#1F1D2B]">{activeNavMeta.label}</span>
                </p>
                <h1 className="font-heading text-base sm:text-lg font-semibold text-[#1F1D2B] truncate">
                  3D Jummo Fashion World Store Operations
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              {/* Live Firestore Sync Badge */}
              <button
                type="button"
                onClick={() => {
                  if (hasPermission('settings:manage')) setActiveSection('settings');
                }}
                title="Live Cloud Firestore Connection Status"
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer ${
                  monitor.firestoreStatus === 'live'
                    ? 'bg-[#16A34A]'
                    : monitor.firestoreStatus === 'empty_cloud'
                      ? 'bg-[#2563EB]'
                      : monitor.firestoreStatus === 'connecting'
                        ? 'bg-[#F59E0B]'
                        : 'bg-[#DC2626]'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-white" aria-hidden="true" />
                <span>
                  {monitor.firestoreStatus === 'live'
                    ? 'FIRESTORE LIVE'
                    : monitor.firestoreStatus === 'empty_cloud'
                      ? 'CLOUD READY'
                      : monitor.firestoreStatus === 'connecting'
                        ? 'SYNCING...'
                        : 'OFFLINE / ERROR'}
                </span>
              </button>

              {/* Live Event Notifications Bell */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((o) => !o)}
                  aria-label="View store event notifications"
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#1F1D2B]/12 bg-[#FFF8EF] text-[#1F1D2B] hover:border-[#FF7A00] cursor-pointer"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-[#DC2626] text-[10px] font-bold text-white tabular-nums">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-[#1F1D2B]/12 bg-white p-3 shadow-2xl z-40">
                    <div className="flex items-center justify-between px-2 pb-2 border-b border-[#1F1D2B]/10">
                      <span className="font-heading text-sm font-semibold">
                        Live Store Alerts ({combinedNotifications.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setNotificationsOpen(false)}
                        className="text-xs font-semibold text-[#FF7A00] cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                    <div className="mt-2 max-h-80 overflow-y-auto space-y-2">
                      {combinedNotifications.length === 0 ? (
                        <p className="p-4 text-center text-xs text-[#1F1D2B]/55">
                          All clear — no active operational alerts.
                        </p>
                      ) : (
                        combinedNotifications.slice(0, 20).map((n) => {
                          const isRead = user?.uid ? n.readBy.includes(user.uid) : false;
                          return (
                            <div
                              key={n.notificationId}
                              className={`rounded-xl p-2.5 text-xs border ${
                                isRead
                                  ? 'bg-white border-[#1F1D2B]/8 opacity-75'
                                  : 'bg-[#FFF8EF] border-[#FF7A00]/25'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-semibold text-[#1F1D2B]">{n.title}</span>
                                <ProductBadge
                                  tone={
                                    n.severity === 'error'
                                      ? 'error'
                                      : n.severity === 'warning'
                                        ? 'warning'
                                        : n.severity === 'success'
                                          ? 'success'
                                          : 'info'
                                  }
                                >
                                  {n.type.replace('_', ' ')}
                                </ProductBadge>
                              </div>
                              <p className="mt-1 text-[#1F1D2B]/75">{n.message}</p>
                              <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#1F1D2B]/50 tabular-nums">
                                <span>
                                  {new Date(n.createdAt).toLocaleString('en-IN', {
                                    timeZone: REPORTING_TIMEZONE,
                                    dateStyle: 'short',
                                    timeStyle: 'short',
                                  })}
                                </span>
                                {!n.derived && !isRead && (
                                  <button
                                    type="button"
                                    onClick={() => void handleMarkRead(n)}
                                    className="inline-flex items-center gap-1 font-semibold text-[#FF7A00] hover:underline cursor-pointer"
                                  >
                                    <CheckCheck className="h-3 w-3" />
                                    Mark Read
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Authenticated Staff Profile & Sign Out */}
              <div className="hidden sm:flex items-center gap-2 rounded-xl border border-[#1F1D2B]/12 bg-[#FFF8EF] px-3 py-1.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1F1D2B] text-xs font-bold text-[#FFA94D]">
                  {(user?.displayName || user?.email || 'A').charAt(0).toUpperCase()}
                </span>
                <div className="max-w-[140px]">
                  <p className="text-[11px] font-bold text-[#1F1D2B] truncate leading-tight">
                    {user?.displayName || user?.email?.split('@')[0] || 'Staff'}
                  </p>
                  <p className="text-[10px] font-semibold uppercase text-[#FF7A00] leading-tight">
                    {roleMeta?.label || role.replace('_', ' ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void logout()}
                  title="Sign out of Admin Console"
                  aria-label="Sign out"
                  className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-[#1F1D2B]/65 hover:bg-[#DC2626]/10 hover:text-[#DC2626] cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Workspace */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1440px] w-full mx-auto">
          {syncWarning && (
            <StatusAlert
              variant="warning"
              title="Firestore Sync Notice"
              description={syncWarning}
            />
          )}

          {activeSection === 'dashboard' && (
            <AdminOverviewSection
              orders={orders}
              payments={payments}
              refunds={refunds}
              customers={customers}
              products={products}
              activityLogs={activityLogs}
              onNavigateSection={(sec) => {
                if (visibleNavItems.some((item) => item.id === sec)) {
                  setActiveSection(sec);
                }
              }}
              onEditProduct={openEditProduct}
            />
          )}

          {activeSection === 'analytics' && (
            <AdminAnalyticsView
              orders={orders}
              payments={payments}
              refunds={refunds}
              products={products}
              categories={categories}
            />
          )}

          {activeSection === 'orders' && <AdminOrdersView orders={orders} />}

          {activeSection === 'payments' && (
            <AdminPaymentsRefundsView
              mode="payments"
              orders={orders}
              payments={payments}
              refunds={refunds}
            />
          )}

          {activeSection === 'refunds' && (
            <AdminPaymentsRefundsView
              mode="refunds"
              orders={orders}
              payments={payments}
              refunds={refunds}
            />
          )}

          {activeSection === 'customers' && (
            <AdminCustomersView customers={customers} orders={orders} />
          )}

          {activeSection === 'inventory' && (
            <AdminInventoryView
              movements={inventoryHistory}
              onEditProduct={openEditProduct}
            />
          )}

          {activeSection === 'products' &&
            (productSubView === 'all' ? (
              <AdminProductsView
                onAddProduct={openAddProduct}
                onEditProduct={openEditProduct}
              />
            ) : (
              <AdminProductForm
                existingProduct={
                  productSubView === 'edit' && editingProductId
                    ? getProductByIdOrSlug(editingProductId) || null
                    : null
                }
                onCancel={() => setProductSubView('all')}
                onSaved={() => setProductSubView('all')}
              />
            ))}

          {activeSection === 'categories' && <AdminCategoriesView />}

          {activeSection === 'offers' && <AdminCouponsView coupons={coupons} />}

          {activeSection === 'staff' && <AdminStaffRolesView staffMembers={staffMembers} />}

          {activeSection === 'showroom' && (
            <AdminShowroomControlView showroomSections={showroomSections} />
          )}

          {activeSection === 'reports' && <AdminReportsView />}

          {activeSection === 'activity' && <AdminActivityLogsView logs={activityLogs} />}

          {activeSection === 'settings' && <AdminDatabaseMonitor />}
        </main>
      </div>
    </div>
  );
};

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  onSwitchToStorefront,
}) => (
  <AdminAuthGate onSwitchToStorefront={onSwitchToStorefront}>
    <AdminDashboardContent onSwitchToStorefront={onSwitchToStorefront} />
  </AdminAuthGate>
);
