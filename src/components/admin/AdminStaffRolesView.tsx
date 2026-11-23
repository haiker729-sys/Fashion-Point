import React, { useState } from 'react';
import {
  Loader2,
  Shield,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { deleteStaffMemberApi, saveStaffMemberApi } from '../../services/adminApi';
import type { StaffMemberDoc } from '../../types/admin';
import {
  ALL_STAFF_ROLES,
  ROLE_DEFAULT_PERMISSIONS,
  STAFF_ROLE_META,
  type StaffRole,
} from '../../utils/adminPermissions';
import { REPORTING_TIMEZONE } from '../../utils/adminAnalytics';
import { ConfirmationDialog, useToast } from '../ui/Overlays';
import { Button, ProductBadge, StatusAlert } from '../ui/Primitives';

interface AdminStaffRolesViewProps {
  staffMembers: StaffMemberDoc[];
}

export const AdminStaffRolesView: React.FC<AdminStaffRolesViewProps> = ({ staffMembers }) => {
  const { user, hasPermission } = useAuth();
  const { addToast } = useToast();

  const canManageStaff = hasPermission('staff:manage');

  const [uid, setUid] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<StaffRole>('manager');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const [deleteUid, setDeleteUid] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageStaff || saving) return;
    setSaving(true);
    try {
      await saveStaffMemberApi(user, {
        uid: uid.trim(),
        email: email.trim().toLowerCase(),
        displayName: displayName.trim(),
        role,
        active,
      });
      addToast({
        type: 'success',
        title: 'Staff Role Saved',
        description: `Assigned ${STAFF_ROLE_META[role].label} privileges to ${email.trim()}.`,
      });
      setUid('');
      setEmail('');
      setDisplayName('');
      setRole('manager');
      setActive(true);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Role Assignment Rejected',
        description: err instanceof Error ? err.message : 'Unable to save staff record.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleQuickRoleUpdate = async (member: StaffMemberDoc, nextRole: StaffRole, nextActive: boolean) => {
    if (!canManageStaff) return;
    try {
      await saveStaffMemberApi(user, {
        uid: member.uid,
        email: member.email,
        displayName: member.displayName,
        role: nextRole,
        active: nextActive,
      });
      addToast({
        type: 'success',
        title: 'Permissions Updated',
        description: `${member.displayName} is now ${STAFF_ROLE_META[nextRole].label} (${nextActive ? 'Active' : 'Suspended'}).`,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Update Blocked',
        description: err instanceof Error ? err.message : 'Unable to update staff role.',
      });
    }
  };

  const handleRevokeStaff = async () => {
    if (!deleteUid || deleting) return;
    setDeleting(true);
    try {
      await deleteStaffMemberApi(user, deleteUid);
      addToast({
        type: 'success',
        title: 'Staff Access Revoked',
        description: `Removed UID ${deleteUid} from the Firestore admins registry.`,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Revocation Blocked',
        description: err instanceof Error ? err.message : 'Unable to revoke staff access.',
      });
    } finally {
      setDeleting(false);
      setDeleteUid(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-[#FF7A00]">
          Role-Based Access Control (RBAC) · Privilege Escalation Guarded
        </p>
        <h2 className="font-heading text-xl sm:text-2xl font-bold text-[#1F1D2B]">
          Staff &amp; Role Management ({staffMembers.length})
        </h2>
        <p className="text-xs text-[#1F1D2B]/65 mt-0.5">
          Manage the five store roles (Super Admin, Admin, Manager, Staff, Accountant) enforced in
          both Firestore Security Rules and Express backend endpoints.
        </p>
      </div>

      {!canManageStaff && (
        <StatusAlert
          variant="info"
          title="Super Admin Authority Required for Role Changes"
          description="Only the verified Super Admin can assign, modify, or revoke staff roles in Firestore admins/{uid}."
        />
      )}

      {/* 5-Role Permission Matrix Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {ALL_STAFF_ROLES.map((r) => {
          const meta = STAFF_ROLE_META[r];
          const perms = ROLE_DEFAULT_PERMISSIONS[r];
          return (
            <div
              key={r}
              className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-4 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-bold"
                    style={{ color: meta.colorHex }}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    {meta.label}
                  </span>
                  <span className="text-[11px] font-mono text-[#1F1D2B]/55 tabular-nums">
                    {perms.length} perms
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-[#1F1D2B]/70 leading-relaxed">
                  {meta.description}
                </p>
              </div>
              <div className="text-[10px] font-mono text-[#1F1D2B]/50 border-t border-[#1F1D2B]/8 pt-2">
                {perms.slice(0, 4).join(', ')}
                {perms.length > 4 ? ` +${perms.length - 4}` : ''}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Assign Staff Member Form (Super Admin Only) */}
      {canManageStaff && (
        <form
          onSubmit={handleSaveStaff}
          className="rounded-2xl border border-[#1F1D2B]/12 bg-white p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-[#1F1D2B]/10 pb-3">
            <h3 className="font-heading text-sm font-bold text-[#1F1D2B] flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-[#FF7A00]" />
              Assign or Update Staff Member
            </h3>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#16A34A]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Audit Logged Automatically
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <input
              type="text"
              required
              placeholder="Firebase Auth UID"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              className="h-10 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3 font-mono"
            />
            <input
              type="email"
              required
              placeholder="Staff Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3"
            />
            <input
              type="text"
              required
              placeholder="Full Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="h-10 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              className="h-10 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3 font-semibold"
            >
              {ALL_STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {STAFF_ROLE_META[r].label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#1F1D2B] cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 accent-[#FF7A00]"
              />
              Active Staff Account
            </label>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={saving}
              leftIcon={saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : undefined}
            >
              {saving ? 'Saving...' : 'Save Staff Permissions'}
            </Button>
          </div>
        </form>
      )}

      {/* Registered Staff Table */}
      <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white overflow-hidden">
        {staffMembers.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#1F1D2B]/60">
            Only the verified bootstrap Super Admin is currently active. Assign additional Admins,
            Managers, Staff, or Accountants above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1F1D2B]/10 bg-[#FFF8EF]/70 text-[#1F1D2B]/60">
                  <th className="py-3 px-4 font-semibold">Staff Member</th>
                  <th className="py-3 px-4 font-semibold">UID</th>
                  <th className="py-3 px-4 font-semibold">Assigned Role</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Updated (IST)</th>
                  {canManageStaff && <th className="py-3 px-4 font-semibold text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F1D2B]/8">
                {staffMembers.map((member) => (
                  <tr key={member.uid} className="hover:bg-[#FFF8EF]/45">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-[#1F1D2B]">{member.displayName}</p>
                      <p className="text-[11px] text-[#1F1D2B]/60">{member.email}</p>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#1F1D2B]/65">
                      {member.uid}
                    </td>
                    <td className="py-3 px-4">
                      {canManageStaff ? (
                        <select
                          value={member.role}
                          onChange={(e) =>
                            void handleQuickRoleUpdate(
                              member,
                              e.target.value as StaffRole,
                              member.active
                            )
                          }
                          aria-label={`Change role for ${member.displayName}`}
                          className="h-8 rounded-lg border border-[#1F1D2B]/15 bg-white px-2 text-xs font-semibold"
                        >
                          {ALL_STAFF_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {STAFF_ROLE_META[r].label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <ProductBadge tone="info">{STAFF_ROLE_META[member.role].label}</ProductBadge>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <ProductBadge tone={member.active ? 'success' : 'error'}>
                        {member.active ? 'ACTIVE' : 'SUSPENDED'}
                      </ProductBadge>
                    </td>
                    <td className="py-3 px-4 tabular-nums text-[#1F1D2B]/65 whitespace-nowrap">
                      {new Date(member.updatedAt).toLocaleDateString('en-IN', {
                        timeZone: REPORTING_TIMEZONE,
                      })}
                    </td>
                    {canManageStaff && (
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                        <button
                          type="button"
                          onClick={() =>
                            void handleQuickRoleUpdate(member, member.role, !member.active)
                          }
                          className="text-xs font-semibold text-[#1F1D2B]/75 hover:text-[#FF7A00] cursor-pointer"
                        >
                          {member.active ? 'Suspend' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteUid(member.uid)}
                          aria-label={`Revoke ${member.displayName}`}
                          className="inline-flex p-1.5 rounded-lg border border-[#DC2626]/20 text-[#DC2626] hover:bg-[#DC2626]/10 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmationDialog
        open={Boolean(deleteUid)}
        onClose={() => setDeleteUid(null)}
        onConfirm={() => void handleRevokeStaff()}
        title="Revoke Staff Dashboard Access?"
        message={`This removes UID ${deleteUid || ''} from the Firestore admins registry immediately. They will lose all staff console access.`}
        confirmLabel={deleting ? 'Revoking...' : 'Revoke Access'}
        destructive
      />
    </div>
  );
};
