export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayFailureResponse {
  error: {
    code?: string;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
    metadata?: {
      order_id?: string;
      payment_id?: string;
    };
  };
}

export interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: 'INR';
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
    escape?: boolean;
    confirm_close?: boolean;
  };
  handler: (response: RazorpaySuccessResponse) => void;
}

export interface RazorpayInstance {
  open: () => void;
  close: () => void;
  on: (event: 'payment.failed', callback: (response: RazorpayFailureResponse) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}

const RAZORPAY_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let loadingPromise: Promise<void> | null = null;

/**
 * Dynamically loads the official Razorpay Checkout script once on demand.
 * Never collects or handles raw card numbers, CVV, or UPI PIN inside Fashion World.
 */
export function loadRazorpayCheckoutScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay Checkout requires a browser environment.'));
  }
  if (typeof window.Razorpay === 'function') {
    return Promise.resolve();
  }
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_SCRIPT_SRC}"]`
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => {
          loadingPromise = null;
          reject(new Error('Unable to load official Razorpay Checkout script.'));
        },
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (typeof window.Razorpay === 'function') {
        resolve();
      } else {
        loadingPromise = null;
        reject(new Error('Razorpay Checkout loaded without initializing window.Razorpay.'));
      }
    };
    script.onerror = () => {
      loadingPromise = null;
      reject(
        new Error(
          'Unable to load Razorpay Checkout (https://checkout.razorpay.com/v1/checkout.js). Please check your internet connection.'
        )
      );
    };
    document.body.appendChild(script);
  });

  return loadingPromise;
}
