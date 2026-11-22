import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { isFirebaseConfigured } from '../firebase/firebaseConfig';
import {
  registerCustomerAccount,
  requestPasswordResetEmail,
  resolveTrustedStaffSession,
  signInWithEmailPassword,
  signInWithGooglePopup,
  signOutCurrentUser,
  subscribeAuthState,
  syncUserProfileDocument,
  updateOwnUserProfile,
  type AppUserRole,
  type UserProfileRecord,
} from '../firebase/authentication';
import { formatFirebaseError, type FriendlyFirebaseError } from '../firebase/firebaseErrors';
import { isStaffRole, type AdminPermission } from '../utils/adminPermissions';
import { useToast } from '../components/ui/Overlays';

interface AuthContextValue {
  user: User | null;
  profile: UserProfileRecord | null;
  role: AppUserRole;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isStaff: boolean;
  permissions: AdminPermission[];
  hasPermission: (permission: AdminPermission) => boolean;
  authReady: boolean;
  authBusy: boolean;
  authError: FriendlyFirebaseError | null;
  isFirebaseConfigured: boolean;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<boolean>;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  registerCustomer: (input: {
    displayName: string;
    email: string;
    password: string;
    phone?: string;
  }) => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfileDetails: (patch: { displayName: string; phone: string }) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { addToast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfileRecord | null>(null);
  const [role, setRole] = useState<AppUserRole>('guest');
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<FriendlyFirebaseError | null>(null);

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeAuthState((nextUser) => {
      if (!active) return;
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setRole('guest');
        setPermissions([]);
        setAuthReady(true);
        return;
      }

      Promise.all([
        resolveTrustedStaffSession(nextUser),
        syncUserProfileDocument(nextUser),
      ])
        .then(([session, syncedProfile]) => {
          if (!active) return;
          setRole(session.role);
          setPermissions(session.permissions);
          setProfile(syncedProfile);
          setAuthReady(true);
        })
        .catch(() => {
          if (!active) return;
          setRole('customer');
          setPermissions([]);
          setAuthReady(true);
        });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const signInWithGoogle = useCallback(async (): Promise<boolean> => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const signedIn = await signInWithGooglePopup();
      const session = await resolveTrustedStaffSession(signedIn);
      setRole(session.role);
      setPermissions(session.permissions);
      addToast({
        type: 'success',
        title: 'Signed In with Google',
        description: `Welcome, ${signedIn.displayName || signedIn.email || 'Member'}.`,
      });
      return true;
    } catch (err) {
      const formatted = formatFirebaseError(err);
      setAuthError(formatted);
      addToast({
        type: formatted.tone,
        title: formatted.title,
        description: formatted.message,
      });
      return false;
    } finally {
      setAuthBusy(false);
    }
  }, [addToast]);

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setAuthBusy(true);
      setAuthError(null);
      try {
        const signedIn = await signInWithEmailPassword(email, password);
        const session = await resolveTrustedStaffSession(signedIn);
        setRole(session.role);
        setPermissions(session.permissions);
        addToast({
          type: 'success',
          title: 'Signed In Successfully',
          description: `Welcome back, ${signedIn.displayName || signedIn.email}.`,
        });
        return true;
      } catch (err) {
        const formatted = formatFirebaseError(err);
        setAuthError(formatted);
        addToast({
          type: formatted.tone,
          title: formatted.title,
          description: formatted.message,
        });
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [addToast]
  );

  const registerCustomer = useCallback(
    async (input: {
      displayName: string;
      email: string;
      password: string;
      phone?: string;
    }): Promise<boolean> => {
      setAuthBusy(true);
      setAuthError(null);
      try {
        const created = await registerCustomerAccount(input);
        setRole('customer');
        addToast({
          type: 'success',
          title: 'Account Created',
          description: `Welcome to 3D Jummo Fashion World, ${created.displayName || input.displayName}.`,
        });
        return true;
      } catch (err) {
        const formatted = formatFirebaseError(err);
        setAuthError(formatted);
        addToast({
          type: formatted.tone,
          title: formatted.title,
          description: formatted.message,
        });
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [addToast]
  );

  const sendPasswordReset = useCallback(
    async (email: string): Promise<boolean> => {
      setAuthBusy(true);
      setAuthError(null);
      try {
        await requestPasswordResetEmail(email);
        addToast({
          type: 'success',
          title: 'Password Reset Email Sent',
          description: `Check ${email.trim()} for your Firebase password reset link.`,
        });
        return true;
      } catch (err) {
        const formatted = formatFirebaseError(err);
        setAuthError(formatted);
        addToast({
          type: formatted.tone,
          title: formatted.title,
          description: formatted.message,
        });
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [addToast]
  );

  const logout = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signOutCurrentUser();
      setProfile(null);
      setRole('guest');
      setPermissions([]);
      addToast({
        type: 'info',
        title: 'Signed Out',
        description: 'Your session has been securely closed.',
      });
    } catch (err) {
      const formatted = formatFirebaseError(err);
      setAuthError(formatted);
      addToast({
        type: formatted.tone,
        title: formatted.title,
        description: formatted.message,
      });
    } finally {
      setAuthBusy(false);
    }
  }, [addToast]);

  const updateProfileDetails = useCallback(
    async (patch: { displayName: string; phone: string }): Promise<boolean> => {
      if (!user) return false;
      setAuthBusy(true);
      try {
        await updateOwnUserProfile(user.uid, patch);
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                displayName: patch.displayName.trim(),
                phone: patch.phone.trim(),
                updatedAt: new Date().toISOString(),
              }
            : prev
        );
        addToast({
          type: 'success',
          title: 'Profile Saved to Firestore',
          description: 'Your personal details have been updated.',
        });
        return true;
      } catch (err) {
        const formatted = formatFirebaseError(err);
        addToast({
          type: formatted.tone,
          title: formatted.title,
          description: formatted.message,
        });
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [addToast, user]
  );

  const isStaff = isStaffRole(role);
  const isAdmin = role === 'admin' || role === 'super_admin';
  const isSuperAdmin = role === 'super_admin';
  const hasPermission = useCallback(
    (permission: AdminPermission) =>
      role === 'super_admin' || permissions.includes(permission),
    [permissions, role]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        isAdmin,
        isSuperAdmin,
        isStaff,
        permissions,
        hasPermission,
        authReady,
        authBusy,
        authError,
        isFirebaseConfigured,
        clearAuthError,
        signInWithGoogle,
        signInWithEmail,
        registerCustomer,
        sendPasswordReset,
        logout,
        updateProfileDetails,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
};
