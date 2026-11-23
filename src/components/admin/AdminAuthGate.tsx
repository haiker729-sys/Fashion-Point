import React, { useState } from 'react';
import {
  ArrowLeft,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Mail,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { firebaseConfigMeta } from '../../firebase/firebaseConfig';
import { BrandLogo } from '../ui/BrandLogo';
import { Button, InputField, StatusAlert } from '../ui/Primitives';

interface AdminAuthGateProps {
  onSwitchToStorefront: () => void;
  children: React.ReactNode;
}

export const AdminAuthGate: React.FC<AdminAuthGateProps> = ({
  onSwitchToStorefront,
  children,
}) => {
  const {
    user,
    role,
    isStaff,
    authReady,
    authBusy,
    authError,
    clearAuthError,
    signInWithGoogle,
    signInWithEmail,
    sendPasswordReset,
    logout,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#1F1D2B] text-[#FFF8EF] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#FF7A00]" />
          <p className="font-heading text-base font-semibold">
            Verifying Firebase Admin Session...
          </p>
          <p className="text-xs text-[#FFF8EF]/60">
            Checking Authentication &amp; Firestore Role Registry
          </p>
        </div>
      </div>
    );
  }

  // Authorized Staff Role (Super Admin, Admin, Manager, Staff, Accountant) — unlock Console
  if (user && isStaff) {
    return <>{children}</>;
  }

  // Authenticated Customer without Staff/Admin Privileges
  if (user && !isStaff) {
    return (
      <div className="min-h-screen bg-[#FFF8EF] text-[#1F1D2B] flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl border border-[#DC2626]/25 bg-white p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#DC2626]/12 text-[#DC2626]">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#DC2626]">
                Access Restricted · Role Verification Failed
              </p>
              <h1 className="mt-1 font-heading text-xl font-bold text-[#1F1D2B]">
                Authorized Staff / Admin Account Required
              </h1>
              <p className="mt-2 text-sm text-[#1F1D2B]/75 leading-relaxed">
                You are currently signed in as{' '}
                <strong className="text-[#1F1D2B]">{user.email || user.uid}</strong> with role{' '}
                <span className="rounded bg-[#FFE4C7] px-1.5 py-0.5 font-mono text-xs font-semibold text-[#1F1D2B]">
                  {role}
                </span>
                . Dashboard access is strictly verified via Firebase Authentication and the
                protected Firestore <code className="font-mono text-xs">admins</code> registry
                (Super Admin, Admin, Manager, Staff, Accountant).
              </p>
            </div>
          </div>

          <StatusAlert
            variant="info"
            title="How Staff / Admin Access Is Granted"
            description="Sign in with the verified store owner Google account or ask a Super Admin to assign your staff role in Firestore admins/{uid}."
          />

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#1F1D2B]/10">
            <Button
              variant="primary"
              size="md"
              leftIcon={<LogOut className="h-4 w-4" />}
              onClick={() => void logout()}
              disabled={authBusy}
            >
              Sign Out &amp; Switch Account
            </Button>
            <Button
              variant="outline"
              size="md"
              leftIcon={<ArrowLeft className="h-4 w-4" />}
              onClick={onSwitchToStorefront}
            >
              Return to Storefront
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Unauthenticated — Render Admin Firebase Sign-In Gate
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearAuthError();
    if (!email.trim() || !password) {
      setLocalError('Enter both admin email and password.');
      return;
    }
    await signInWithEmail(email, password);
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearAuthError();
    if (!email.trim()) {
      setLocalError('Enter your registered admin email address.');
      return;
    }
    const ok = await sendPasswordReset(email);
    if (ok) setResetSent(true);
  };

  return (
    <div className="min-h-screen bg-[#1F1D2B] text-[#FFF8EF] flex flex-col justify-between p-4 sm:p-8">
      <div className="mx-auto w-full max-w-[1100px] flex items-center justify-between">
        <BrandLogo variant="dark" onClick={onSwitchToStorefront} />
        <button
          type="button"
          onClick={onSwitchToStorefront}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/6 px-3.5 py-2 text-xs font-semibold text-[#FFF8EF] hover:border-[#FFA94D] hover:text-[#FFA94D] cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Storefront
        </button>
      </div>

      <div className="mx-auto my-8 w-full max-w-md rounded-2xl border border-white/12 bg-white text-[#1F1D2B] p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-lg bg-[#FFE4C7] px-2.5 py-1 text-[11px] font-semibold text-[#1F1D2B]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#FF7A00]" />
            Protected Admin Console · Firebase Auth
          </div>
          <h1 className="font-heading text-2xl font-bold text-[#1F1D2B]">
            {mode === 'login' ? 'Admin Sign In' : 'Reset Admin Password'}
          </h1>
          <p className="text-xs text-[#1F1D2B]/65 leading-relaxed">
            Authenticate with your authorized Firebase Admin account to manage Cloud Firestore
            products, categories, inventory, and Firebase Storage uploads.
          </p>
        </div>

        {(localError || authError) && (
          <StatusAlert
            variant={localError ? 'error' : authError?.tone || 'error'}
            title={localError ? 'Validation Error' : authError?.title || 'Authentication Error'}
            description={localError || authError?.message || ''}
          />
        )}

        {resetSent && mode === 'reset' && (
          <StatusAlert
            variant="success"
            title="Reset Email Dispatched"
            description="Check your inbox for the Firebase password reset link, then return to sign in."
          />
        )}

        {/* Primary Recommended Sign-In: Google Sign-In */}
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          disabled={authBusy}
          onClick={() => void signInWithGoogle()}
          leftIcon={
            authBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )
          }
        >
          Continue with Google (Admin)
        </Button>

        <div className="relative flex items-center py-1">
          <div className="flex-1 border-t border-[#1F1D2B]/12" />
          <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-[#1F1D2B]/45">
            Or Email &amp; Password
          </span>
          <div className="flex-1 border-t border-[#1F1D2B]/12" />
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <InputField
              id="admin-login-email"
              label="Admin Email"
              type="email"
              placeholder="admin@fashionworld.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="h-4 w-4" />}
              required
            />
            <InputField
              id="admin-login-password"
              label="Password"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="h-4 w-4" />}
              required
            />

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setMode('reset');
                  setResetSent(false);
                  setLocalError('');
                  clearAuthError();
                }}
                className="text-xs font-semibold text-[#FF7A00] hover:text-[#1F1D2B] cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>

            <Button
              type="submit"
              variant="secondary"
              size="md"
              fullWidth
              disabled={authBusy}
              leftIcon={<KeyRound className="h-4 w-4" />}
            >
              {authBusy ? 'Authenticating...' : 'Sign In with Email'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <InputField
              id="admin-reset-email"
              label="Admin Email Address"
              type="email"
              placeholder="admin@fashionworld.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="h-4 w-4" />}
              required
            />
            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => {
                  setMode('login');
                  setLocalError('');
                  clearAuthError();
                }}
              >
                Back
              </Button>
              <Button type="submit" variant="secondary" size="md" fullWidth disabled={authBusy}>
                {authBusy ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </div>
          </form>
        )}

        <p className="text-[11px] text-[#1F1D2B]/55 border-t border-[#1F1D2B]/10 pt-3">
          Project: <span className="font-mono font-semibold">{firebaseConfigMeta.projectId}</span> ·
          Email/Password login requires enabling the Email/Password provider in Firebase Console
          (see <span className="font-mono">FIREBASE_SETUP.md</span>).
        </p>
      </div>

      <p className="text-center text-[11px] text-[#FFF8EF]/50">
        3D Jummo Fashion World · Role-Based Admin Access Control
      </p>
    </div>
  );
};
