export type StaffRole = 'super_admin' | 'admin' | 'manager' | 'staff' | 'accountant';

export type AppUserRole = StaffRole | 'customer' | 'guest';

export type AdminPermission =
  | 'dashboard:view'
  | 'analytics:view'
  | 'orders:view'
  | 'orders:update'
  | 'orders:note'
  | 'payments:view'
  | 'refunds:view'
  | 'refunds:initiate'
  | 'customers:view'
  | 'customers:pii'
  | 'customers:manage'
  | 'inventory:view'
  | 'inventory:update'
  | 'products:view'
  | 'products:manage'
  | 'categories:manage'
  | 'coupons:view'
  | 'coupons:manage'
  | 'staff:view'
  | 'staff:manage'
  | 'showroom:view'
  | 'showroom:manage'
  | 'reports:financial'
  | 'reports:operational'
  | 'notifications:view'
  | 'activity:view'
  | 'settings:manage';

export const ALL_STAFF_ROLES: StaffRole[] = [
  'super_admin',
  'admin',
  'manager',
  'staff',
  'accountant',
];

export const STAFF_ROLE_META: Record<
  StaffRole,
  { label: string; description: string; colorHex: string }
> = {
  super_admin: {
    label: 'Super Admin',
    description: 'Full store control including staff permissions, refunds, settings, and deletion.',
    colorHex: '#FF7A00',
  },
  admin: {
    label: 'Admin',
    description: 'Assigned store-management control across catalog, orders, payments, refunds, and reports.',
    colorHex: '#1F1D2B',
  },
  manager: {
    label: 'Manager',
    description: 'Operational leadership over orders, inventory stock movements, catalog visibility, and showroom.',
    colorHex: '#2563EB',
  },
  staff: {
    label: 'Staff',
    description: 'Restricted operational access for order fulfillment notes and stock adjustments.',
    colorHex: '#16A34A',
  },
  accountant: {
    label: 'Accountant',
    description: 'Read-only financial access to revenue analytics, verified payments, refunds, and financial CSV exports.',
    colorHex: '#F59E0B',
  },
};

export const ROLE_DEFAULT_PERMISSIONS: Record<StaffRole, AdminPermission[]> = {
  super_admin: [
    'dashboard:view',
    'analytics:view',
    'orders:view',
    'orders:update',
    'orders:note',
    'payments:view',
    'refunds:view',
    'refunds:initiate',
    'customers:view',
    'customers:pii',
    'customers:manage',
    'inventory:view',
    'inventory:update',
    'products:view',
    'products:manage',
    'categories:manage',
    'coupons:view',
    'coupons:manage',
    'staff:view',
    'staff:manage',
    'showroom:view',
    'showroom:manage',
    'reports:financial',
    'reports:operational',
    'notifications:view',
    'activity:view',
    'settings:manage',
  ],
  admin: [
    'dashboard:view',
    'analytics:view',
    'orders:view',
    'orders:update',
    'orders:note',
    'payments:view',
    'refunds:view',
    'refunds:initiate',
    'customers:view',
    'customers:pii',
    'customers:manage',
    'inventory:view',
    'inventory:update',
    'products:view',
    'products:manage',
    'categories:manage',
    'coupons:view',
    'coupons:manage',
    'staff:view',
    'showroom:view',
    'showroom:manage',
    'reports:financial',
    'reports:operational',
    'notifications:view',
    'activity:view',
    'settings:manage',
  ],
  manager: [
    'dashboard:view',
    'analytics:view',
    'orders:view',
    'orders:update',
    'orders:note',
    'customers:view',
    'inventory:view',
    'inventory:update',
    'products:view',
    'products:manage',
    'categories:manage',
    'coupons:view',
    'showroom:view',
    'showroom:manage',
    'reports:operational',
    'notifications:view',
    'activity:view',
  ],
  staff: [
    'dashboard:view',
    'orders:view',
    'orders:note',
    'inventory:view',
    'inventory:update',
    'products:view',
    'showroom:view',
    'notifications:view',
  ],
  accountant: [
    'dashboard:view',
    'analytics:view',
    'orders:view',
    'payments:view',
    'refunds:view',
    'reports:financial',
    'notifications:view',
    'activity:view',
  ],
};

export function isStaffRole(role: string): role is StaffRole {
  return ALL_STAFF_ROLES.includes(role as StaffRole);
}

export function resolveRolePermissions(
  role: AppUserRole,
  customOverrides?: string[]
): Set<AdminPermission> {
  if (!isStaffRole(role)) return new Set();
  if (role === 'super_admin') {
    return new Set(ROLE_DEFAULT_PERMISSIONS.super_admin);
  }
  const defaults = ROLE_DEFAULT_PERMISSIONS[role];
  if (!Array.isArray(customOverrides) || customOverrides.length === 0) {
    return new Set(defaults);
  }
  // Custom overrides can only grant permissions allowed for non-super-admin store ops
  // and NEVER grant staff:manage (reserved strictly for super_admin).
  const allowedOverridePool = new Set<AdminPermission>(
    ROLE_DEFAULT_PERMISSIONS.admin.filter((p) => p !== 'staff:manage')
  );
  const resolved = new Set<AdminPermission>();
  for (const perm of customOverrides) {
    if (allowedOverridePool.has(perm as AdminPermission)) {
      resolved.add(perm as AdminPermission);
    }
  }
  resolved.add('dashboard:view');
  return resolved;
}

export function hasAdminPermission(
  role: AppUserRole,
  permission: AdminPermission,
  customOverrides?: string[]
): boolean {
  return resolveRolePermissions(role, customOverrides).has(permission);
}

/**
 * Masks customer email/phone for restricted roles that do not hold `customers:pii`.
 */
export function maskEmailForRole(email: string, canViewPii: boolean): string {
  if (canViewPii || !email) return email;
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const prefix = local.slice(0, Math.min(2, local.length));
  return `${prefix}***@${domain}`;
}

export function maskPhoneForRole(phone: string, canViewPii: boolean): string {
  if (canViewPii || !phone) return phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '******';
  return `******${digits.slice(-4)}`;
}
