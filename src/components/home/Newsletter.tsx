import React, { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { AlertCircle, CheckCircle2, Mail, Send } from 'lucide-react';
import { Button } from '../ui/Primitives';
import { useToast } from '../ui/Overlays';

export const Newsletter: React.FC = () => {
  const { addToast } = useToast();
  const prefersReducedMotion = useReducedMotion();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'error' | 'success'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = email.trim();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned);

    if (!validEmail) {
      setStatus('error');
      setMessage('Please enter a valid email address (for example, name@domain.com).');
      addToast({
        type: 'error',
        title: '✕ Invalid Email Address',
        description: 'Enter a valid email to join the 3D Jummo Fashion World list.',
      });
      return;
    }

    setStatus('success');
    setMessage(
      `Welcome to 3D Jummo Fashion World — ${cleaned} is subscribed to private seasonal lookbooks and 3D showroom unveiling alerts.`
    );
    setEmail('');
    addToast({
      type: 'success',
      title: '✓ Subscribed Successfully',
      description: 'Frontend newsletter confirmation (backend sync arrives in later phases).',
    });
  };

  return (
    <section
      aria-labelledby="newsletter-heading"
      className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-16 sm:pb-20"
    >
      <div className="rounded-3xl border border-[#FFA94D]/45 bg-[#FFE4C7]/55 p-6 sm:p-10 lg:p-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-2.5">
            <p className="text-xs font-semibold text-[#FF7A00]">Private Atelier List</p>
            <h2
              id="newsletter-heading"
              className="font-heading text-2xl sm:text-3xl font-bold text-[#1F1D2B] tracking-tight text-balance"
            >
              Receive Early Festival Previews &amp; 3D Showroom Invitations
            </h2>
            <p className="text-sm text-[#1F1D2B]/72 leading-relaxed max-w-lg">
              Join our newsletter for first access to limited handloom releases, member-only offers,
              and Phase 3 virtual mall launch dates.
            </p>
          </div>

          <div className="lg:col-span-6 space-y-3">
            <form
              onSubmit={handleSubmit}
              noValidate
              className="flex flex-col sm:flex-row gap-3"
            >
              <div className="relative flex-1">
                <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#1F1D2B]/50" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (status !== 'idle') setStatus('idle');
                  }}
                  placeholder="Enter your email address"
                  aria-label="Email address for newsletter"
                  aria-invalid={status === 'error'}
                  className={`w-full min-h-[48px] rounded-xl border bg-white pl-11 pr-4 text-sm text-[#1F1D2B] placeholder:text-[#1F1D2B]/45 focus:outline-none focus:ring-4 transition-colors ${
                    status === 'error'
                      ? 'border-[#DC2626] focus:ring-[#DC2626]/20'
                      : status === 'success'
                        ? 'border-[#16A34A] focus:ring-[#16A34A]/20'
                        : 'border-[#1F1D2B]/15 focus:border-[#FF7A00] focus:ring-[#FF7A00]/20'
                  }`}
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                rightIcon={<Send className="h-4 w-4" />}
              >
                Subscribe
              </Button>
            </form>

            {status === 'error' && (
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-[#DC2626]/30 bg-[#DC2626]/8 px-4 py-3 text-xs font-medium text-[#7F1D1D]"
              >
                <AlertCircle className="h-4 w-4 text-[#DC2626] shrink-0 mt-0.5" />
                <span>{message}</span>
              </motion.div>
            )}

            {status === 'success' && (
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                role="status"
                className="flex items-start gap-2.5 rounded-xl border border-[#16A34A]/35 bg-[#16A34A]/10 px-4 py-3 text-xs font-medium text-[#14532D]"
              >
                <CheckCircle2 className="h-4 w-4 text-[#16A34A] shrink-0 mt-0.5" />
                <span>{message}</span>
              </motion.div>
            )}

            <p className="text-[11px] text-[#1F1D2B]/55">
              Zero spam. Unsubscribe anytime. Frontend validation preview (Phase 2).
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
