import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  CloudUpload,
  Database,
  Download,
  HardDrive,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Tag,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCatalog } from '../../context/CatalogContext';
import { seedSampleCouponsInFirestore } from '../../firebase/commerce';
import { firebaseConfigMeta, isFirebaseConfigured, missingConfigKeys } from '../../firebase/firebaseConfig';
import { Button, InputField, ProductBadge, StatusAlert } from '../ui/Primitives';
import { AdminPaymentsPrepCard } from './AdminPaymentsPrepCard';

export const AdminDatabaseMonitor: React.FC = () => {
  const { user, role } = useAuth();
  const {
    monitor,
    storeSettings,
    lowStockThreshold,
    refreshConnectionCheck,
    exportLocalDemoBackup,
    runDemoToFirestoreMigration,
    saveStoreSettings,
  } = useCatalog();

  const [storeName, setStoreName] = useState(
    storeSettings?.storeName || '3D Jummo Fashion World'
  );
  const [thresholdInput, setThresholdInput] = useState(
    String(storeSettings?.lowStockThreshold ?? lowStockThreshold)
  );
  const [announcementText, setAnnouncementText] = useState(
    storeSettings?.announcementText ||
      'Complimentary Express Insured Delivery on Orders Above ₹999'
  );
  const [lightingPreset, setLightingPreset] = useState<
    'warm_luxury' | 'daylight_atelier' | 'evening_gala'
  >(storeSettings?.showroomDefaultLighting || 'warm_luxury');
  const [savingSettings, setSavingSettings] = useState(false);
  const [seedingCoupons, setSeedingCoupons] = useState(false);
  const [couponSeedResult, setCouponSeedResult] = useState<{
    created: string[];
    skipped: string[];
    error?: string;
  } | null>(null);

  const handleSeedCoupons = async () => {
    setSeedingCoupons(true);
    setCouponSeedResult(null);
    try {
      const res = await seedSampleCouponsInFirestore();
      setCouponSeedResult(res);
    } catch (err) {
      setCouponSeedResult({
        created: [],
        skipped: [],
        error: err instanceof Error ? err.message : 'Unable to seed Firestore coupons.',
      });
    } finally {
      setSeedingCoupons(false);
    }
  };

  useEffect(() => {
    if (storeSettings) {
      setStoreName(storeSettings.storeName);
      setThresholdInput(String(storeSettings.lowStockThreshold));
      setAnnouncementText(storeSettings.announcementText);
      setLightingPreset(storeSettings.showroomDefaultLighting);
    }
  }, [storeSettings]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    await saveStoreSettings({
      storeName,
      currencyCode: 'INR',
      lowStockThreshold: Math.max(1, Math.min(500, Math.floor(Number(thresholdInput) || 10))),
      announcementText,
      showroomDefaultLighting: lightingPreset,
    });
    setSavingSettings(false);
  };

  const formatTimestamp = (iso: string | null) => {
    if (!iso) return 'Not yet synced';
    try {
      return new Date(iso).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'medium',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#FF7A00]">
            Phase 5 · Cloud Infrastructure &amp; Sync Operations
          </p>
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-[#1F1D2B]">
            Firebase Database, Storage &amp; Migration
          </h2>
          <p className="text-xs text-[#1F1D2B]/65 mt-0.5">
            Live telemetry from Cloud Firestore, Firebase Authentication, and Firebase Storage —
            every status indicator reflects real SDK state.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          onClick={() => void refreshConnectionCheck()}
        >
          Re-Test Firestore Connection
        </Button>
      </div>

      {!isFirebaseConfigured && (
        <StatusAlert
          variant="error"
          title="Firebase Configuration Incomplete"
          description={`Missing configuration keys: ${missingConfigKeys.join(', ')}. Review FIREBASE_SETUP.md and .env.example.`}
        />
      )}

      {monitor.lastError && (
        <StatusAlert
          variant="error"
          title="Latest Firebase Error"
          description={monitor.lastError}
        />
      )}

      {/* Real-Time Status Cards Grid (No Fake Indicators) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* 1. Connection Status */}
        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#1F1D2B]/60">Firebase Connection</span>
            {monitor.connectionStatus === 'connected' ? (
              <Wifi className="h-4 w-4 text-[#16A34A]" />
            ) : (
              <WifiOff className="h-4 w-4 text-[#DC2626]" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <ProductBadge
              tone={
                monitor.connectionStatus === 'connected'
                  ? 'success'
                  : monitor.connectionStatus === 'checking'
                    ? 'warning'
                    : 'error'
              }
            >
              {monitor.connectionStatus === 'connected'
                ? 'Connected'
                : monitor.connectionStatus === 'checking'
                  ? 'Checking...'
                  : monitor.connectionStatus === 'unconfigured'
                    ? 'Unconfigured'
                    : 'Offline'}
            </ProductBadge>
            {monitor.connectionCheck && (
              <span className="text-[11px] font-mono text-[#1F1D2B]/55 tabular-nums">
                {monitor.connectionCheck.latencyMs}ms
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#1F1D2B]/65">
            {monitor.connectionCheck?.message || 'Awaiting connection check'}
          </p>
        </div>

        {/* 2. Authentication Status */}
        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#1F1D2B]/60">Authentication Status</span>
            <ShieldCheck className="h-4 w-4 text-[#16A34A]" />
          </div>
          <div className="flex items-center gap-2">
            <ProductBadge tone="success">{role.replace('_', ' ').toUpperCase()}</ProductBadge>
            {user?.emailVerified && (
              <span className="text-[11px] font-semibold text-[#16A34A]">Verified</span>
            )}
          </div>
          <p className="text-[11px] text-[#1F1D2B]/70 truncate" title={user?.email || ''}>
            {user?.email || 'Not signed in'}
          </p>
        </div>

        {/* 3. Cloud Firestore Status */}
        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#1F1D2B]/60">Cloud Firestore</span>
            <Database className="h-4 w-4 text-[#FF7A00]" />
          </div>
          <div className="flex items-center gap-2">
            <ProductBadge
              tone={
                monitor.firestoreStatus === 'live'
                  ? 'success'
                  : monitor.firestoreStatus === 'empty_cloud'
                    ? 'info'
                    : monitor.firestoreStatus === 'connecting'
                      ? 'warning'
                      : 'error'
              }
            >
              {monitor.firestoreStatus === 'live'
                ? 'Live Real-Time Sync'
                : monitor.firestoreStatus === 'empty_cloud'
                  ? 'Connected · Empty'
                  : monitor.firestoreStatus === 'connecting'
                    ? 'Connecting...'
                    : 'Error / Offline'}
            </ProductBadge>
          </div>
          <p className="text-[11px] text-[#1F1D2B]/70 tabular-nums">
            {monitor.cloudProductCount} products · {monitor.cloudCategoryCount} categories in cloud
          </p>
        </div>

        {/* 4. Firebase Storage Status */}
        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#1F1D2B]/60">Firebase Storage</span>
            <HardDrive className="h-4 w-4 text-[#2563EB]" />
          </div>
          <div className="flex items-center gap-2">
            <ProductBadge
              tone={
                monitor.storageStatus === 'ready'
                  ? 'success'
                  : monitor.storageStatus === 'uploading'
                    ? 'info'
                    : 'error'
              }
            >
              {monitor.storageStatus === 'ready'
                ? 'Ready'
                : monitor.storageStatus === 'uploading'
                  ? `Uploading (${monitor.pendingUploads})`
                  : monitor.storageStatus === 'error'
                    ? 'Upload Error'
                    : 'Unconfigured'}
            </ProductBadge>
          </div>
          <p className="text-[11px] text-[#1F1D2B]/70 tabular-nums truncate">
            Pending uploads: {monitor.pendingUploads} · {firebaseConfigMeta.storageBucket}
          </p>
        </div>
      </section>

      {/* Detailed Metadata & Last Sync Bar */}
      <section className="rounded-2xl border border-[#1F1D2B]/10 bg-[#1F1D2B] text-[#FFF8EF] p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div>
          <p className="text-[#FFA94D] font-semibold">Active Data Source</p>
          <p className="mt-1 font-heading text-sm font-bold">
            {monitor.dataSource === 'firestore'
              ? 'Cloud Firestore (Live Real-Time)'
              : 'Local Phase 4 Demo Preview (Migrate Below)'}
          </p>
          <p className="mt-0.5 text-[11px] text-[#FFF8EF]/65 font-mono">
            DB: {firebaseConfigMeta.firestoreDatabaseId}
          </p>
        </div>
        <div>
          <p className="text-[#FFA94D] font-semibold">Last Successful Sync</p>
          <p className="mt-1 font-mono text-sm font-semibold">
            {formatTimestamp(monitor.lastSyncAt)}
          </p>
          <p className="mt-0.5 text-[11px] text-[#FFF8EF]/65">
            Project: {firebaseConfigMeta.projectId}
          </p>
        </div>
        <div>
          <p className="text-[#FFA94D] font-semibold">Last Recorded Error</p>
          <p className="mt-1 text-xs leading-snug text-[#FFF8EF]/85">
            {monitor.lastError ? monitor.lastError : 'No active Firebase errors recorded.'}
          </p>
        </div>
      </section>

      {/* Safe Local-to-Firestore Migration Console */}
      <section className="rounded-2xl border border-[#1F1D2B]/12 bg-white p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF7A00]">
              <CloudUpload className="h-4 w-4" />
              Safe Demo-to-Firestore Migration Utility
            </div>
            <h3 className="font-heading text-lg font-bold text-[#1F1D2B]">
              Import Phase 4 Local Demo Catalog into Cloud Firestore
            </h3>
            <p className="text-xs text-[#1F1D2B]/65 max-w-2xl leading-relaxed">
              Detected <strong>{monitor.localDemoCategoryCount} categories</strong> and{' '}
              <strong>{monitor.localDemoProductCount} products</strong> in your local Phase 4
              catalog. Migration preserves document IDs, prevents duplicate IDs/SKUs, validates
              every record against <code className="font-mono">firestore.rules</code>, and{' '}
              <strong>never auto-deletes</strong> your local data.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="md"
              leftIcon={<Download className="h-4 w-4" />}
              onClick={exportLocalDemoBackup}
            >
              1. Backup Local Demo (JSON)
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={monitor.isMigrating || !isFirebaseConfigured}
              leftIcon={
                monitor.isMigrating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Cloud className="h-4 w-4" />
                )
              }
              onClick={() => void runDemoToFirestoreMigration()}
            >
              {monitor.isMigrating ? 'Migrating to Firestore...' : '2. Migrate to Cloud Firestore'}
            </Button>
          </div>
        </div>

        {monitor.lastMigrationReport && (
          <div className="rounded-xl border border-[#1F1D2B]/12 bg-[#FFF8EF] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-xs font-bold text-[#1F1D2B]">
                {monitor.lastMigrationReport.failed.length === 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-[#F59E0B]" />
                )}
                Migration Report · {formatTimestamp(monitor.lastMigrationReport.completedAt)}
              </span>
              <ProductBadge
                tone={monitor.lastMigrationReport.failed.length === 0 ? 'success' : 'warning'}
              >
                {monitor.lastMigrationReport.failed.length === 0
                  ? 'Zero Failures'
                  : `${monitor.lastMigrationReport.failed.length} Failed`}
              </ProductBadge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs tabular-nums">
              <div className="rounded-lg bg-white p-3 border border-[#1F1D2B]/8">
                <p className="text-[#1F1D2B]/55">Categories Created</p>
                <p className="mt-1 font-heading text-lg font-bold text-[#16A34A]">
                  {monitor.lastMigrationReport.categoriesCreated}
                </p>
              </div>
              <div className="rounded-lg bg-white p-3 border border-[#1F1D2B]/8">
                <p className="text-[#1F1D2B]/55">Categories Skipped</p>
                <p className="mt-1 font-heading text-lg font-bold text-[#2563EB]">
                  {monitor.lastMigrationReport.categoriesSkipped}
                </p>
              </div>
              <div className="rounded-lg bg-white p-3 border border-[#1F1D2B]/8">
                <p className="text-[#1F1D2B]/55">Products Created</p>
                <p className="mt-1 font-heading text-lg font-bold text-[#16A34A]">
                  {monitor.lastMigrationReport.productsCreated}
                </p>
              </div>
              <div className="rounded-lg bg-white p-3 border border-[#1F1D2B]/8">
                <p className="text-[#1F1D2B]/55">Products Skipped</p>
                <p className="mt-1 font-heading text-lg font-bold text-[#2563EB]">
                  {monitor.lastMigrationReport.productsSkipped}
                </p>
              </div>
            </div>

            {monitor.lastMigrationReport.failed.length > 0 && (
              <ul className="space-y-1.5 text-xs text-[#DC2626] pt-2 border-t border-[#1F1D2B]/10">
                {monitor.lastMigrationReport.failed.map((f) => (
                  <li key={`${f.entity}-${f.id}`}>
                    • [{f.entity}] {f.name} ({f.id}): {f.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Phase 6 Firestore Coupon Seed Utility */}
      <section className="rounded-2xl border border-[#1F1D2B]/12 bg-white p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF7A00]">
              <Tag className="h-4 w-4" />
              Phase 6 · Firestore Coupons Collection
            </div>
            <h3 className="font-heading text-lg font-bold text-[#1F1D2B]">
              Seed Live Sample Coupons (<code className="font-mono">JUMMO10</code> &amp;{' '}
              <code className="font-mono">FESTIVE500</code>)
            </h3>
            <p className="text-xs text-[#1F1D2B]/65 max-w-2xl leading-relaxed">
              Creates verified coupon documents in Cloud Firestore (<code className="font-mono">coupons/JUMMO10</code>{' '}
              for 10% off ≥ ₹999 max ₹500, and <code className="font-mono">coupons/FESTIVE500</code>{' '}
              for ₹500 off ≥ ₹2,999) so live cart &amp; checkout coupon validation can be tested immediately.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={seedingCoupons || !isFirebaseConfigured}
            leftIcon={
              seedingCoupons ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Tag className="h-4 w-4" />
              )
            }
            onClick={() => void handleSeedCoupons()}
          >
            {seedingCoupons ? 'Seeding Coupons…' : 'Seed Sample Coupons'}
          </Button>
        </div>

        {couponSeedResult && (
          <div
            className={`rounded-xl border p-3.5 text-xs ${
              couponSeedResult.error
                ? 'border-[#DC2626]/30 bg-[#DC2626]/8 text-[#DC2626]'
                : 'border-[#16A34A]/30 bg-[#16A34A]/10 text-[#1F1D2B]'
            }`}
          >
            {couponSeedResult.error ? (
              <p className="font-semibold">{couponSeedResult.error}</p>
            ) : (
              <p>
                <strong>Created:</strong>{' '}
                {couponSeedResult.created.length > 0 ? couponSeedResult.created.join(', ') : 'None'}{' '}
                · <strong>Already Existing (Skipped):</strong>{' '}
                {couponSeedResult.skipped.length > 0 ? couponSeedResult.skipped.join(', ') : 'None'}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Phase 7 Razorpay Gateway Status & Payment Data Preparation */}
      <AdminPaymentsPrepCard />

      {/* Firestore Store Settings Collection Editor (settings/storefront) */}
      <form
        onSubmit={handleSaveSettings}
        className="rounded-2xl border border-[#1F1D2B]/12 bg-white p-5 sm:p-6 space-y-5"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF7A00]">
              <Sparkles className="h-4 w-4" />
              Firestore Collection: <code className="font-mono">settings/storefront</code>
            </div>
            <h3 className="mt-0.5 font-heading text-lg font-bold text-[#1F1D2B]">
              Storefront &amp; 3D Showroom Cloud Settings
            </h3>
          </div>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={savingSettings}
            leftIcon={
              savingSettings ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )
            }
          >
            {savingSettings ? 'Saving...' : 'Save to Firestore'}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InputField
            id="settings-store-name"
            label="Store Display Name"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            required
          />
          <InputField
            id="settings-low-stock"
            label="Global Low-Stock Alert Threshold"
            type="number"
            min={1}
            max={500}
            value={thresholdInput}
            onChange={(e) => setThresholdInput(e.target.value)}
            required
          />
          <div className="space-y-1.5">
            <label
              htmlFor="settings-lighting"
              className="block text-xs font-semibold text-[#1F1D2B]"
            >
              3D Showroom Default Lighting
            </label>
            <select
              id="settings-lighting"
              value={lightingPreset}
              onChange={(e) =>
                setLightingPreset(
                  e.target.value as 'warm_luxury' | 'daylight_atelier' | 'evening_gala'
                )
              }
              className="w-full h-11 rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-sm text-[#1F1D2B] focus:border-[#FF7A00] focus:outline-none"
            >
              <option value="warm_luxury">Warm Luxury (Gold Rings)</option>
              <option value="daylight_atelier">Daylight Atelier</option>
              <option value="evening_gala">Evening Gala</option>
            </select>
          </div>
        </div>

        <InputField
          id="settings-announcement"
          label="Announcement Banner Message"
          value={announcementText}
          onChange={(e) => setAnnouncementText(e.target.value)}
        />
      </form>
    </div>
  );
};
