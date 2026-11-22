import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  isStaffRole,
  resolveRolePermissions,
  type AdminPermission,
  type StaffRole,
} from '../src/utils/adminPermissions';

export interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId: string;
  apiKey?: string;
}

export interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  name: string;
  rawToken: string;
}

const BOOTSTRAP_SUPER_ADMIN_EMAIL = 'merajalam906090@gmail.com';
const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedConfig: FirebaseAppletConfig | null = null;
let cachedCerts: Record<string, string> = {};
let certsExpiresAtMs = 0;

export function getFirebaseServerConfig(): FirebaseAppletConfig {
  if (cachedConfig) return cachedConfig;
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Partial<FirebaseAppletConfig>;
  cachedConfig = {
    projectId: String(raw.projectId || process.env.VITE_FIREBASE_PROJECT_ID || ''),
    firestoreDatabaseId: String(
      raw.firestoreDatabaseId || process.env.VITE_FIREBASE_DATABASE_ID || '(default)'
    ),
    apiKey: raw.apiKey,
  };
  return cachedConfig;
}

async function fetchGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (Object.keys(cachedCerts).length > 0 && now < certsExpiresAtMs) {
    return cachedCerts;
  }

  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) {
    throw new Error(`Unable to fetch Firebase public signing certificates (${res.status}).`);
  }

  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;

  const certs = (await res.json()) as Record<string, string>;
  cachedCerts = certs;
  certsExpiresAtMs = now + Math.max(60, maxAgeSec - 30) * 1000;
  return cachedCerts;
}

function decodeBase64UrlJson<T>(segment: string): T {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as T;
}

function decodeBase64UrlBuffer(segment: string): Buffer {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

/**
 * Cryptographically verifies a Firebase Auth ID Token (RS256) against Google's
 * official public X.509 signing certificates without requiring GCP IAM Admin SDK permissions.
 */
export async function verifyFirebaseIdToken(
  authorizationHeader?: string
): Promise<VerifiedFirebaseUser> {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization Bearer token.');
  }

  const token = authorizationHeader.slice('Bearer '.length).trim();
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed Firebase ID token.');
  }

  const [headerSeg, payloadSeg, sigSeg] = parts;
  const header = decodeBase64UrlJson<{ alg?: string; kid?: string }>(headerSeg);
  const payload = decodeBase64UrlJson<{
    iss?: string;
    aud?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    email?: string;
    email_verified?: boolean;
    name?: string;
  }>(payloadSeg);

  const { projectId } = getFirebaseServerConfig();
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  const nowSec = Math.floor(Date.now() / 1000);

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Unsupported Firebase ID token signing algorithm.');
  }
  if (payload.aud !== projectId || payload.iss !== expectedIssuer) {
    throw new Error('Firebase ID token project or issuer mismatch.');
  }
  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length > 128) {
    throw new Error('Firebase ID token subject (uid) is invalid.');
  }
  if (!payload.exp || payload.exp <= nowSec) {
    throw new Error('Firebase ID token has expired. Please refresh your session.');
  }
  if (!payload.iat || payload.iat > nowSec + 300) {
    throw new Error('Firebase ID token issue time is invalid.');
  }

  const certs = await fetchGooglePublicCerts();
  const certPem = certs[header.kid];
  if (!certPem) {
    throw new Error('Firebase ID token signing key ID is unrecognized.');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerSeg}.${payloadSeg}`);
  verifier.end();

  const signatureValid = verifier.verify(certPem, decodeBase64UrlBuffer(sigSeg));
  if (!signatureValid) {
    throw new Error('Firebase ID token cryptographic signature verification failed.');
  }

  return {
    uid: payload.sub,
    email: String(payload.email || ''),
    emailVerified: Boolean(payload.email_verified),
    name: String(payload.name || ''),
    rawToken: token,
  };
}

/* -------------------------------------------------------------------------- */
/* FIRESTORE V1 REST API HELPERS (USING CALLER'S VERIFIED FIREBASE ID TOKEN)  */
/* -------------------------------------------------------------------------- */

type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { stringValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

export function fromFirestoreValue(val: FirestoreValue | undefined): unknown {
  if (!val || typeof val !== 'object') return undefined;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('stringValue' in val) return val.stringValue;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map((v) => fromFirestoreValue(v));
  }
  if ('mapValue' in val) {
    const out: Record<string, unknown> = {};
    const fields = val.mapValue.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = fromFirestoreValue(v);
    }
    return out;
  }
  return undefined;
}

export function toFirestoreValue(val: unknown): FirestoreValue {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map((v) => toFirestoreValue(v)) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function getFirestoreBaseUrl(): string {
  const { projectId, firestoreDatabaseId } = getFirebaseServerConfig();
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/${encodeURIComponent(firestoreDatabaseId)}/documents`;
}

export async function firestoreRestGetDocument(
  docPath: string,
  idToken: string
): Promise<Record<string, unknown> | null> {
  const url = `${getFirestoreBaseUrl()}/${docPath}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Firestore read failed (${res.status}) for ${docPath}: ${errText.slice(0, 180)}`);
  }
  const body = (await res.json()) as { fields?: Record<string, FirestoreValue> };
  const decoded: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body.fields || {})) {
    decoded[k] = fromFirestoreValue(v);
  }
  return decoded;
}

export async function firestoreRestWriteWithServerTimestamps(
  docPath: string,
  fields: Record<string, unknown>,
  options: {
    idToken: string;
    isCreate: boolean;
    updateMaskFields?: string[];
  }
): Promise<{ synced: boolean; status: number; error?: string }> {
  const { projectId, firestoreDatabaseId } = getFirebaseServerConfig();
  const fullDocName = `projects/${projectId}/databases/${firestoreDatabaseId}/documents/${docPath}`;
  const commitUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/${encodeURIComponent(firestoreDatabaseId)}/documents:commit`;

  const encodedFields: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) {
      encodedFields[k] = toFirestoreValue(v);
    }
  }

  const fieldTransforms: Array<{ fieldPath: string; setToServerValue: 'REQUEST_TIME' }> = [
    { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
  ];
  if (options.isCreate) {
    fieldTransforms.push({ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' });
  }

  const updateWrite: Record<string, unknown> = {
    update: {
      name: fullDocName,
      fields: encodedFields,
    },
    updateTransforms: fieldTransforms,
  };

  if (options.updateMaskFields && options.updateMaskFields.length > 0) {
    updateWrite.updateMask = { fieldPaths: options.updateMaskFields };
  }

  const res = await fetch(commitUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ writes: [updateWrite] }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return {
      synced: false,
      status: res.status,
      error: errText.slice(0, 220),
    };
  }
  return { synced: true, status: res.status };
}

export async function firestoreRestGetDocumentWithMeta(
  docPath: string,
  idToken: string
): Promise<{ data: Record<string, unknown>; updateTime: string } | null> {
  const url = `${getFirestoreBaseUrl()}/${docPath}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Firestore read failed (${res.status}) for ${docPath}: ${errText.slice(0, 180)}`);
  }
  const body = (await res.json()) as {
    fields?: Record<string, FirestoreValue>;
    updateTime?: string;
  };
  const decoded: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body.fields || {})) {
    decoded[k] = fromFirestoreValue(v);
  }
  return {
    data: decoded,
    updateTime: String(body.updateTime || ''),
  };
}

export async function firestoreRestListCollection(
  collectionId: string,
  idToken: string,
  pageSize = 250
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const safeSize = Math.max(1, Math.min(500, Math.floor(pageSize)));
  const url = `${getFirestoreBaseUrl()}/${encodeURIComponent(collectionId)}?pageSize=${safeSize}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(
      `Firestore list failed (${res.status}) for ${collectionId}: ${errText.slice(0, 180)}`
    );
  }
  const body = (await res.json()) as {
    documents?: Array<{ name?: string; fields?: Record<string, FirestoreValue> }>;
  };
  return (body.documents || []).map((docItem) => {
    const segments = String(docItem.name || '').split('/');
    const id = segments[segments.length - 1] || '';
    const decoded: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(docItem.fields || {})) {
      decoded[k] = fromFirestoreValue(v);
    }
    return { id, data: decoded };
  });
}

export async function firestoreRestDeleteDocument(
  docPath: string,
  idToken: string
): Promise<{ ok: boolean; status: number; error?: string }> {
  const url = `${getFirestoreBaseUrl()}/${docPath}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { ok: false, status: res.status, error: errText.slice(0, 220) };
  }
  return { ok: true, status: res.status };
}

export interface FirestoreAtomicWriteSpec {
  docPath: string;
  fields: Record<string, unknown>;
  isCreate: boolean;
  updateMaskFields?: string[];
  /** Optional timestamp fields set via REQUEST_TIME (defaults to ['updatedAt'] + 'createdAt' on create) */
  serverTimestampFields?: string[];
  /** Optional ISO timestamp values that must be encoded as Firestore TimestampValue (e.g., startDate/expiryDate) */
  timestampFieldPaths?: string[];
  /** Optimistic concurrency precondition: fails with 400/412 if doc changed since updateTime */
  preconditionUpdateTime?: string;
}

export async function firestoreRestCommitWrites(
  specs: FirestoreAtomicWriteSpec[],
  idToken: string
): Promise<{ synced: boolean; status: number; conflict?: boolean; error?: string }> {
  const { projectId, firestoreDatabaseId } = getFirebaseServerConfig();
  const commitUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/${encodeURIComponent(firestoreDatabaseId)}/documents:commit`;

  const writes = specs.map((spec) => {
    const fullDocName = `projects/${projectId}/databases/${firestoreDatabaseId}/documents/${spec.docPath}`;
    const tsSet = new Set(spec.timestampFieldPaths || []);
    const encodedFields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(spec.fields)) {
      if (v === undefined) continue;
      if (tsSet.has(k) && typeof v === 'string') {
        encodedFields[k] = { timestampValue: v };
      } else {
        encodedFields[k] = toFirestoreValue(v);
      }
    }

    const serverTsList =
      spec.serverTimestampFields ||
      (spec.isCreate ? ['createdAt', 'updatedAt'] : ['updatedAt']);

    const updateTransforms = serverTsList.map((fieldPath) => ({
      fieldPath,
      setToServerValue: 'REQUEST_TIME' as const,
    }));

    const writeOp: Record<string, unknown> = {
      update: {
        name: fullDocName,
        fields: encodedFields,
      },
      updateTransforms,
    };

    if (spec.updateMaskFields && spec.updateMaskFields.length > 0) {
      writeOp.updateMask = { fieldPaths: spec.updateMaskFields };
    }
    if (spec.preconditionUpdateTime) {
      writeOp.currentDocument = { updateTime: spec.preconditionUpdateTime };
    }
    return writeOp;
  });

  const res = await fetch(commitUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ writes }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const conflict =
      res.status === 412 ||
      res.status === 409 ||
      /FAILED_PRECONDITION|does not match/i.test(errText);
    return {
      synced: false,
      status: res.status,
      conflict,
      error: errText.slice(0, 260),
    };
  }
  return { synced: true, status: res.status };
}

export interface ResolvedStaffContext {
  user: VerifiedFirebaseUser;
  role: StaffRole | 'customer';
  isStaff: boolean;
  isSuperAdmin: boolean;
  displayName: string;
  permissions: Set<AdminPermission>;
}

/**
 * Resolves a caller's authoritative staff role and granular permissions strictly on the server
 * from their verified Firebase ID token and the Firestore `admins/{uid}` document.
 */
export async function resolveVerifiedStaffContext(
  user: VerifiedFirebaseUser
): Promise<ResolvedStaffContext> {
  if (user.emailVerified && user.email.toLowerCase() === BOOTSTRAP_SUPER_ADMIN_EMAIL) {
    return {
      user,
      role: 'super_admin',
      isStaff: true,
      isSuperAdmin: true,
      displayName: user.name || user.email.split('@')[0] || 'Super Admin',
      permissions: resolveRolePermissions('super_admin'),
    };
  }

  try {
    const adminDoc = await firestoreRestGetDocument(`admins/${user.uid}`, user.rawToken);
    if (adminDoc && adminDoc.active === true && typeof adminDoc.role === 'string' && isStaffRole(adminDoc.role)) {
      const customPerms = Array.isArray(adminDoc.permissions)
        ? adminDoc.permissions.filter((p): p is string => typeof p === 'string')
        : undefined;
      return {
        user,
        role: adminDoc.role,
        isStaff: true,
        isSuperAdmin: adminDoc.role === 'super_admin',
        displayName: String(adminDoc.displayName || user.name || user.email.split('@')[0] || 'Staff'),
        permissions: resolveRolePermissions(adminDoc.role, customPerms),
      };
    }
  } catch {
    // Non-staff user or unreadable admins doc
  }

  return {
    user,
    role: 'customer',
    isStaff: false,
    isSuperAdmin: false,
    displayName: user.name || user.email.split('@')[0] || 'Customer',
    permissions: new Set(),
  };
}

export async function isVerifiedAdminUser(user: VerifiedFirebaseUser): Promise<boolean> {
  const ctx = await resolveVerifiedStaffContext(user);
  return ctx.isStaff && (ctx.role === 'admin' || ctx.role === 'super_admin');
}

export const BOOTSTRAP_SUPER_ADMIN = BOOTSTRAP_SUPER_ADMIN_EMAIL;
