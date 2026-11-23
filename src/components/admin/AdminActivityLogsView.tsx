import React, { useMemo, useState } from 'react';
import { History, ShieldCheck } from 'lucide-react';
import type { ActivityLogDoc } from '../../types/admin';
import { REPORTING_TIMEZONE } from '../../utils/adminAnalytics';
import { ALL_STAFF_ROLES, STAFF_ROLE_META, type StaffRole } from '../../utils/adminPermissions';
import { ProductBadge, SearchBar } from '../ui/Primitives';

interface AdminActivityLogsViewProps {
  logs: ActivityLogDoc[];
}

export const AdminActivityLogsView: React.FC<AdminActivityLogsViewProps> = ({ logs }) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | StaffRole>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const uniqueActions = useMemo(
    () => Array.from(new Set(logs.map((l) => l.action))).sort(),
    [logs]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (roleFilter !== 'all' && l.actorRole !== roleFilter) return false;
      if (actionFilter !== 'all' && l.action !== actionFilter) return false;
      if (!q) return true;
      return (
        l.action.toLowerCase().includes(q) ||
        l.summary.toLowerCase().includes(q) ||
        l.actorName.toLowerCase().includes(q) ||
        l.actorEmail.toLowerCase().includes(q) ||
        l.entityId.toLowerCase().includes(q)
      );
    });
  }, [actionFilter, logs, roleFilter, search]);

  const actionTone = (action: string) => {
    if (action.includes('Deleted') || action.includes('Refund') || action.includes('Security')) {
      return 'error' as const;
    }
    if (action.includes('Created') || action.includes('Exported')) return 'success' as const;
    if (action.includes('Stock') || action.includes('Permissions')) return 'warning' as const;
    return 'info' as const;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#FF7A00]">
            Append-Only Audit Trail · Enforced by Firestore Rules
          </p>
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-[#1F1D2B]">
            Activity Logs &amp; Security Audit ({filtered.length})
          </h2>
          <p className="text-xs text-[#1F1D2B]/65 mt-0.5">
            Every product edit, stock movement, order transition, refund, coupon update, permission
            change, and CSV export is permanently recorded with actor identity and IST timestamp.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#16A34A]/25 bg-[#16A34A]/10 px-3 py-1.5 text-xs font-semibold text-[#16A34A]">
          <ShieldCheck className="h-4 w-4" />
          Immutable (No Edit / Delete)
        </span>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-4 grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-6">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search actor, email, action, entity ID, or summary..."
          />
        </div>
        <div className="md:col-span-3">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            aria-label="Filter by action type"
            className="w-full h-11 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3 text-xs font-semibold text-[#1F1D2B]"
          >
            <option value="all">All Actions</option>
            {uniqueActions.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-3">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'all' | StaffRole)}
            aria-label="Filter by staff role"
            className="w-full h-11 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3 text-xs font-semibold text-[#1F1D2B]"
          >
            <option value="all">All Staff Roles</option>
            {ALL_STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {STAFF_ROLE_META[r].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <History className="h-8 w-8 mx-auto text-[#1F1D2B]/30" />
            <p className="font-heading text-sm font-bold text-[#1F1D2B]">
              No audit log entries match this filter
            </p>
            <p className="text-xs text-[#1F1D2B]/55">
              Actions executed in the Super Admin Dashboard append here live from Cloud Firestore.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1F1D2B]/10 bg-[#FFF8EF]/70 text-[#1F1D2B]/60">
                  <th className="py-3 px-4 font-semibold">Timestamp (IST)</th>
                  <th className="py-3 px-4 font-semibold">Action</th>
                  <th className="py-3 px-4 font-semibold">Actor &amp; Role</th>
                  <th className="py-3 px-4 font-semibold">Entity</th>
                  <th className="py-3 px-4 font-semibold">Audit Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F1D2B]/8">
                {filtered.map((log) => (
                  <tr key={log.logId} className="hover:bg-[#FFF8EF]/45">
                    <td className="py-3 px-4 tabular-nums text-[#1F1D2B]/65 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('en-IN', {
                        timeZone: REPORTING_TIMEZONE,
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <ProductBadge tone={actionTone(log.action)}>{log.action}</ProductBadge>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <p className="font-semibold text-[#1F1D2B]">{log.actorName}</p>
                      <p className="text-[11px] text-[#1F1D2B]/55">
                        {STAFF_ROLE_META[log.actorRole]?.label || log.actorRole}
                      </p>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#1F1D2B]/75 whitespace-nowrap">
                      {log.entityType}:{log.entityId}
                    </td>
                    <td className="py-3 px-4 text-[#1F1D2B]/85 max-w-md">{log.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
