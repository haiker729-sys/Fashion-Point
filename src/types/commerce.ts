import type { OrderInternalNote, OrderStatusTimelineEvent } from './admin';

export type DeliveryMethod = 'standard' | 'express';

export type PaymentMethod = 'cod' | 'online';

export type PaymentStatus =
  | 'Pending'
  | 'Paid'
  | 'Failed'
  | 'COD Pending'
  | 'Payment Processing'
  | 'Payment Authorized'
  | 'Payment Captured'
  | 'Payment Verified'
  | 'Payment Failed'
  | 'Invalid Signature'
  | 'Payment Verification Failed'
  | 'Verification Pending'
  | 'Refund Initiated'
  | 'Refunded'
  | 'Partially Refunded';

export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Processing'
  | 'Packed'
  | 'Shipped'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled';

export const ORDER_STATUS_STEPS: OrderStatus[] = [
  'Pending',
  'Confirmed',
  'Processing',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
];

export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;

export const SHIPPING_RULES = {
  FREE_STANDARD_THRESHOLD_INR: 999,
  STANDARD_CHARGE_INR: 99,
  EXPRESS_CHARGE_INR: 199,
  STANDARD_ETA: '4–6 Business Days',
  EXPRESS_ETA: '1–2 Business Days',
  TAX_NOTE: 'Prices are inclusive of applicable GST (₹0 additional checkout tax).',
} as const;

export interface CartItemDoc {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  sku: string;
  selectedSize: string;
  selectedColour: string;
  quantity: number;
  priceSnapshot: number;
  addedAt: string;
  updatedAt: string;
}

export interface DeliveryAddressInput {
  fullName: string;
  mobile: string;
  email: string;
  houseFlat: string;
  streetArea: string;
  landmark: string;
  city: string;
  state: string;
  pinCode: string;
  deliveryInstructions: string;
}

export interface SavedAddressDoc extends DeliveryAddressInput {
  id: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CouponDoc {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minOrderValue: number;
  maxDiscount: number;
  startDate: string;
  expiryDate: string;
  usageLimit: number;
  usedCount: number;
  active: boolean;
  description: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CouponValidationResult {
  valid: boolean;
  discount: number;
  message: string;
  coupon?: CouponDoc;
}

export interface OrderItemSnapshot {
  productId: string;
  productName: string;
  productImage: string;
  sku: string;
  selectedSize: string;
  selectedColour: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderDoc {
  orderId: string;
  customerUid: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: OrderItemSnapshot[];
  deliveryAddress: DeliveryAddressInput;
  deliveryMethod: DeliveryMethod;
  subtotal: number;
  catalogSavings: number;
  discount: number;
  couponCode: string;
  deliveryCharge: number;
  tax: number;
  totalAmount: number;
  currency: 'INR';
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  idempotencyKey: string;
  razorpayOrderId?: string;
  latestPaymentId?: string;
  statusHistory?: OrderStatusTimelineEvent[];
  internalNotes?: OrderInternalNote[];
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutPriceBreakdown {
  totalItems: number;
  subtotal: number;
  catalogSavings: number;
  couponDiscount: number;
  couponCode: string;
  deliveryMethod: DeliveryMethod;
  deliveryCharge: number;
  freeDeliveryRemaining: number;
  tax: number;
  totalAmount: number;
}

export interface AddressValidationErrors {
  fullName?: string;
  mobile?: string;
  email?: string;
  houseFlat?: string;
  streetArea?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  deliveryInstructions?: string;
}
