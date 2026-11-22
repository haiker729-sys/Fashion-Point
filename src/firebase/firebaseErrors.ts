import { auth } from './firebaseConfig';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: Array<{
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }>;
  };
}

/**
 * Structured Firestore error logger & thrower for real-time debugging and ErrorBoundary parsing.
 */
export function buildFirestoreErrorInfo(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const currentUser = auth?.currentUser;
  return {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo:
        currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path);
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface FriendlyFirebaseError {
  code: string;
  title: string;
  message: string;
  tone: 'error' | 'warning' | 'info';
}

/**
 * Converts raw Firebase Auth / Firestore / Storage errors into clear user-facing alerts
 * without leaking internal stack traces or secrets.
 */
export function formatFirebaseError(error: unknown): FriendlyFirebaseError {
  const rawCode = (error as { code?: string })?.code || '';
  let rawMessage = error instanceof Error ? error.message : String(error || 'Unknown error');

  // Parse structured FirestoreErrorInfo JSON if thrown by handleFirestoreError
  if (rawMessage.startsWith('{') && rawMessage.includes('"operationType"')) {
    try {
      const parsed = JSON.parse(rawMessage) as FirestoreErrorInfo;
      rawMessage = parsed.error || rawMessage;
    } catch {
      // Keep original string if not valid JSON
    }
  }

  const lower = `${rawCode} ${rawMessage}`.toLowerCase();

  if (lower.includes('auth/invalid-credential') || lower.includes('auth/wrong-password') || lower.includes('auth/user-not-found')) {
    return {
      code: rawCode || 'auth/invalid-credential',
      title: 'Invalid Email or Password',
      message: 'Please check your credentials and try again, or use Forgot Password to reset access.',
      tone: 'error',
    };
  }

  if (lower.includes('auth/email-already-in-use')) {
    return {
      code: 'auth/email-already-in-use',
      title: 'Account Already Exists',
      message: 'An account with this email is already registered. Please sign in instead.',
      tone: 'warning',
    };
  }

  if (lower.includes('auth/weak-password')) {
    return {
      code: 'auth/weak-password',
      title: 'Weak Password',
      message: 'Choose a stronger password with at least 6 characters.',
      tone: 'warning',
    };
  }

  if (lower.includes('auth/operation-not-allowed')) {
    return {
      code: 'auth/operation-not-allowed',
      title: 'Sign-In Method Not Enabled in Firebase Console',
      message:
        'Enable Email/Password authentication in Firebase Console → Authentication → Sign-in method, or sign in with Google.',
      tone: 'warning',
    };
  }

  if (lower.includes('auth/popup-closed-by-user') || lower.includes('auth/cancelled-popup-request')) {
    return {
      code: 'auth/popup-closed-by-user',
      title: 'Sign-In Popup Closed',
      message: 'The Google sign-in window was closed before completing authentication.',
      tone: 'info',
    };
  }

  if (lower.includes('auth/popup-blocked')) {
    return {
      code: 'auth/popup-blocked',
      title: 'Browser Blocked Sign-In Popup',
      message: 'Allow popups for this site or sign in using Email & Password.',
      tone: 'warning',
    };
  }

  if (lower.includes('auth/too-many-requests')) {
    return {
      code: 'auth/too-many-requests',
      title: 'Too Many Attempts',
      message: 'Access temporarily throttled for security. Wait a few minutes before trying again.',
      tone: 'warning',
    };
  }

  if (lower.includes('permission-denied') || lower.includes('missing or insufficient permissions')) {
    return {
      code: 'permission-denied',
      title: 'Permission Denied',
      message:
        'Your current account does not have permission for this Firestore action. Sign in with an authorized Admin account.',
      tone: 'error',
    };
  }

  if (lower.includes('storage/unauthorized')) {
    return {
      code: 'storage/unauthorized',
      title: 'Storage Upload Denied',
      message:
        'Firebase Storage rejected this upload. Ensure you are signed in as a verified Admin and that storage.rules are published in Firebase Console.',
      tone: 'error',
    };
  }

  if (lower.includes('storage/canceled')) {
    return {
      code: 'storage/canceled',
      title: 'Upload Cancelled',
      message: 'Image upload was cancelled before completion.',
      tone: 'info',
    };
  }

  if (lower.includes('storage/quota-exceeded')) {
    return {
      code: 'storage/quota-exceeded',
      title: 'Storage Quota Exceeded',
      message: 'Firebase Storage bucket quota has been reached.',
      tone: 'error',
    };
  }

  if (lower.includes('offline') || lower.includes('network-request-failed') || lower.includes('unavailable')) {
    return {
      code: 'unavailable',
      title: 'Network / Offline Connection',
      message: 'Unable to reach Firebase servers right now. Check your internet connection and retry.',
      tone: 'warning',
    };
  }

  if (lower.includes('failed-precondition') && lower.includes('index')) {
    return {
      code: 'failed-precondition',
      title: 'Firestore Index Required',
      message: 'This query requires a composite index. Check FIREBASE_SETUP.md for index creation.',
      tone: 'warning',
    };
  }

  return {
    code: rawCode || 'firebase/error',
    title: 'Cloud Operation Error',
    message: rawMessage.length > 200 ? `${rawMessage.slice(0, 197)}...` : rawMessage,
    tone: 'error',
  };
}
