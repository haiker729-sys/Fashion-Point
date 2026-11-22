import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebaseConfig';
import {
  OperationType,
  buildFirestoreErrorInfo,
  handleFirestoreError,
} from './firebaseErrors';

import {
  isStaffRole,
  resolveRolePermissions,
  type AdminPermission,
  type StaffRole,
} from '../utils/adminPermissions';

export type AppUserRole = StaffRole | 'customer' | 'guest';

export interface ResolvedStaffSession {
  role: AppUserRole;
  isStaff: boolean;
  permissions: AdminPermission[];
}

export interface UserProfileRecord {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  phone: string;
  role: 'customer' | 'admin' | 'super_admin';
  createdAt: string;
  updatedAt: string;
}

const BOOTSTRAP_SUPER_ADMIN_EMAIL = 'merajalam906090@gmail.com';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

function ensureAuth() {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Firebase Authentication is not configured.');
  }
  return auth;
}

export async function signInWithGooglePopup(): Promise<User> {
  const authInstance = ensureAuth();
  const credential = await signInWithPopup(authInstance, googleProvider);
  await syncUserProfileDocument(credential.user);
  return credential.user;
}

export async function signInWithEmailPassword(
  email: string,
  password: string
): Promise<User> {
  const authInstance = ensureAuth();
  const credential = await signInWithEmailAndPassword(
    authInstance,
    email.trim(),
    password
  );
  await syncUserProfileDocument(credential.user);
  return credential.user;
}

export async function registerCustomerAccount(input: {
  displayName: string;
  email: string;
  password: string;
  phone?: string;
}): Promise<User> {
  const authInstance = ensureAuth();
  const cleanName = input.displayName.trim().slice(0, 100);
  const cleanEmail = input.email.trim();
  const cleanPhone = (input.phone || '').trim().slice(0, 32);

  const credential = await createUserWithEmailAndPassword(
    authInstance,
    cleanEmail,
    input.password
  );

  if (cleanName) {
    await updateProfile(credential.user, { displayName: cleanName });
  }

  await syncUserProfileDocument(credential.user, {
    displayName: cleanName || cleanEmail.split('@')[0] || 'Customer',
    phone: cleanPhone,
  });

  return credential.user;
}

export async function requestPasswordResetEmail(email: string): Promise<void> {
  const authInstance = ensureAuth();
  await sendPasswordResetEmail(authInstance, email.trim());
}

export async function signOutCurrentUser(): Promise<void> {
  const authInstance = ensureAuth();
  await signOut(authInstance);
}

export function subscribeAuthState(callback: (user: User | null) => void): () => void {
  if (!isFirebaseConfigured || !auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

/**
 * Resolves the user's trusted staff role and granular permissions strictly from
 * Firebase Auth verified token and the protected Firestore admins/{uid} collection.
 */
export async function resolveTrustedStaffSession(user: User | null): Promise<ResolvedStaffSession> {
  if (!user) return { role: 'guest', isStaff: false, permissions: [] };

  if (
    user.emailVerified &&
    user.email &&
    user.email.toLowerCase() === BOOTSTRAP_SUPER_ADMIN_EMAIL
  ) {
    return {
      role: 'super_admin',
      isStaff: true,
      permissions: resolveRolePermissions('super_admin'),
    };
  }

  if (!db) return { role: 'customer', isStaff: false, permissions: [] };

  const adminPath = `admins/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    if (snap.exists()) {
      const data = snap.data() as {
        role?: string;
        active?: boolean;
        permissions?: string[];
      };
      if (data.active === true && isStaffRole(data.role)) {
        const customPerms = Array.isArray(data.permissions)
          ? (data.permissions as AdminPermission[])
          : undefined;
        return {
          role: data.role,
          isStaff: true,
          permissions: resolveRolePermissions(data.role, customPerms),
        };
      }
    }
    return { role: 'customer', isStaff: false, permissions: [] };
  } catch (error) {
    const info = buildFirestoreErrorInfo(error, OperationType.GET, adminPath);
    console.warn('Admin role lookup returned restricted/missing:', JSON.stringify(info));
    return { role: 'customer', isStaff: false, permissions: [] };
  }
}

export async function resolveTrustedUserRole(user: User | null): Promise<AppUserRole> {
  const session = await resolveTrustedStaffSession(user);
  return session.role;
}

/**
 * Ensures the authenticated user has a valid profile document at users/{uid}.
 * Enforces role = 'customer' on creation to comply with security rules and prevent elevation.
 */
export async function syncUserProfileDocument(
  user: User,
  overrides?: { displayName?: string; phone?: string }
): Promise<UserProfileRecord | null> {
  if (!db) return null;
  const userPath = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);

  try {
    const snap = await getDoc(ref);
    const displayName = (
      overrides?.displayName ||
      user.displayName ||
      user.email?.split('@')[0] ||
      'Fashion World Member'
    ).slice(0, 100);
    const email = (user.email || 'unknown@fashionworld.local').slice(0, 254);
    const photoURL = (user.photoURL || '').slice(0, 1024);
    const phone = (overrides?.phone || '').slice(0, 32);

    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        displayName,
        email,
        photoURL,
        phone,
        role: 'customer',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const nowIso = new Date().toISOString();
      return {
        uid: user.uid,
        displayName,
        email,
        photoURL,
        phone,
        role: 'customer',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    }

    const existing = snap.data() as Record<string, unknown>;
    return {
      uid: user.uid,
      displayName: String(existing.displayName || displayName),
      email: String(existing.email || email),
      photoURL: String(existing.photoURL || photoURL),
      phone: String(existing.phone || ''),
      role:
        existing.role === 'super_admin' || existing.role === 'admin'
          ? existing.role
          : 'customer',
      createdAt:
        typeof (existing.createdAt as { toDate?: () => Date })?.toDate === 'function'
          ? (existing.createdAt as { toDate: () => Date }).toDate().toISOString()
          : new Date().toISOString(),
      updatedAt:
        typeof (existing.updatedAt as { toDate?: () => Date })?.toDate === 'function'
          ? (existing.updatedAt as { toDate: () => Date }).toDate().toISOString()
          : new Date().toISOString(),
    };
  } catch (error) {
    const info = buildFirestoreErrorInfo(error, OperationType.WRITE, userPath);
    console.warn('User profile sync skipped:', JSON.stringify(info));
    return null;
  }
}

export async function updateOwnUserProfile(
  uid: string,
  patch: { displayName: string; phone: string }
): Promise<void> {
  if (!db) throw new Error('Firestore is not configured.');
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: patch.displayName.trim().slice(0, 100) || 'Member',
      phone: patch.phone.trim().slice(0, 32),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
