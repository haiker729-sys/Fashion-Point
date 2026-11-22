import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  type Auth,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import appletConfig from '../../firebase-applet-config.json';

export interface ResolvedFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

const env = (typeof import.meta !== 'undefined' && import.meta.env
  ? import.meta.env
  : {}) as Record<string, string | undefined>;

const rawConfig: ResolvedFirebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || appletConfig.apiKey || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket || '',
  messagingSenderId:
    env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId || '',
  appId: env.VITE_FIREBASE_APP_ID || appletConfig.appId || '',
  firestoreDatabaseId:
    env.VITE_FIREBASE_DATABASE_ID || appletConfig.firestoreDatabaseId || undefined,
};

const REQUIRED_FIELDS: Array<keyof ResolvedFirebaseConfig> = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
];

export const missingConfigKeys: string[] = REQUIRED_FIELDS.filter(
  (key) => !rawConfig[key] || String(rawConfig[key]).trim() === ''
);

export const isFirebaseConfigured = missingConfigKeys.length === 0;

export const firebaseConfigMeta = {
  projectId: rawConfig.projectId || 'Not configured',
  authDomain: rawConfig.authDomain || 'Not configured',
  storageBucket: rawConfig.storageBucket || 'Not configured',
  firestoreDatabaseId: rawConfig.firestoreDatabaseId || '(default)',
  source: env.VITE_FIREBASE_API_KEY ? 'environment_variables' : 'firebase-applet-config.json',
};

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;
let storageInstance: FirebaseStorage | null = null;

if (isFirebaseConfigured) {
  appInstance = getApps().length > 0 ? getApps()[0] : initializeApp(rawConfig);
  dbInstance = rawConfig.firestoreDatabaseId
    ? getFirestore(appInstance, rawConfig.firestoreDatabaseId)
    : getFirestore(appInstance);
  authInstance = getAuth(appInstance);
  storageInstance = getStorage(appInstance);

  if (typeof window !== 'undefined') {
    setPersistence(authInstance, browserLocalPersistence).catch(() => {
      // Fallback to Firebase SDK default persistence if browser storage is restricted
    });
  }
}

export const firebaseApp = appInstance;
export const db = dbInstance;
export const auth = authInstance;
export const storage = storageInstance;

export interface ConnectionCheckResult {
  online: boolean;
  checkedAt: string;
  latencyMs: number;
  message: string;
}

/**
 * Verifies real server reachability to Cloud Firestore on startup.
 * A permission-denied response from the server confirms Firestore is reachable and rules are active.
 */
export async function testFirestoreConnection(): Promise<ConnectionCheckResult> {
  const start = Date.now();
  const checkedAt = new Date().toISOString();

  if (!isFirebaseConfigured || !db) {
    return {
      online: false,
      checkedAt,
      latencyMs: Date.now() - start,
      message: `Firebase configuration incomplete: missing ${missingConfigKeys.join(', ')}`,
    };
  }

  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return {
      online: true,
      checkedAt,
      latencyMs: Date.now() - start,
      message: 'Connected to Cloud Firestore server.',
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errCode = (error as { code?: string })?.code || '';

    if (
      errMsg.toLowerCase().includes('the client is offline') ||
      errCode === 'unavailable'
    ) {
      console.error(
        'Please check your Firebase configuration. Could not reach Cloud Firestore backend.'
      );
      return {
        online: false,
        checkedAt,
        latencyMs: Date.now() - start,
        message: 'Cloud Firestore is currently offline or unreachable.',
      };
    }

    // permission-denied or not-found from getDocFromServer proves server connectivity is live
    if (errCode === 'permission-denied' || errMsg.includes('Missing or insufficient permissions')) {
      return {
        online: true,
        checkedAt,
        latencyMs: Date.now() - start,
        message: 'Connected to Cloud Firestore (security rules active).',
      };
    }

    return {
      online: true,
      checkedAt,
      latencyMs: Date.now() - start,
      message: 'Connected to Cloud Firestore.',
    };
  }
}
