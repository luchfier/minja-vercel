// src/types/common.types.ts
// Shared TypeScript types — ApiResponse, ApiError, ErrorCode
// Sesuai API_CONTRACT.md §1.1, §1.2, §2

// ============================================================
// Error Codes
// ============================================================

export enum ErrorCode {
  // === General ===
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',

  // === Admin Auth ===
  INVALID_PIN = 'INVALID_PIN',
  ADMIN_LOCKED_OUT = 'ADMIN_LOCKED_OUT',
  PIN_TOO_SHORT = 'PIN_TOO_SHORT',
  PIN_CHANGE_REQUIRES_CURRENT = 'PIN_CHANGE_REQUIRES_CURRENT',
  ADMIN_NOT_INITIALIZED = 'ADMIN_NOT_INITIALIZED',

  // === Session ===
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  INVALID_SESSION_STATE = 'INVALID_SESSION_STATE',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_ALREADY_COMPLETED = 'SESSION_ALREADY_COMPLETED',
  ACTIVE_SESSION_EXISTS = 'ACTIVE_SESSION_EXISTS',

  // === Package ===
  PACKAGE_NOT_FOUND = 'PACKAGE_NOT_FOUND',
  PACKAGE_INACTIVE = 'PACKAGE_INACTIVE',
  PACKAGE_HAS_SESSIONS = 'PACKAGE_HAS_SESSIONS',

  // === Template ===
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',
  TEMPLATE_INACTIVE = 'TEMPLATE_INACTIVE',

  // === Payment & Cash ===
  PAYMENT_CREATION_FAILED = 'PAYMENT_CREATION_FAILED',
  PAYMENT_NOT_FOUND = 'PAYMENT_NOT_FOUND',
  PAYMENT_ALREADY_SETTLED = 'PAYMENT_ALREADY_SETTLED',
  PAYMENT_EXPIRED = 'PAYMENT_EXPIRED',
  PAYMENT_DENIED = 'PAYMENT_DENIED',
  INVALID_WEBHOOK_SIGNATURE = 'INVALID_WEBHOOK_SIGNATURE',
  CASH_UNDERPAID = 'CASH_UNDERPAID',
  CASH_CONFIRMATION_FAILED = 'CASH_CONFIRMATION_FAILED',

  // === Voucher ===
  VOUCHER_NOT_FOUND = 'VOUCHER_NOT_FOUND',
  VOUCHER_EXPIRED = 'VOUCHER_EXPIRED',
  VOUCHER_QUOTA_EXCEEDED = 'VOUCHER_QUOTA_EXCEEDED',
  VOUCHER_MIN_NOT_MET = 'VOUCHER_MIN_NOT_MET',
  VOUCHER_PACKAGE_INELIGIBLE = 'VOUCHER_PACKAGE_INELIGIBLE',
  VOUCHER_INACTIVE = 'VOUCHER_INACTIVE',

  // === Photo ===
  PHOTO_NOT_FOUND = 'PHOTO_NOT_FOUND',
  MAX_PHOTOS_REACHED = 'MAX_PHOTOS_REACHED',
  PHOTO_SESSION_MISMATCH = 'PHOTO_SESSION_MISMATCH',

  // === Camera (Desktop Only) ===
  CAMERA_NOT_FOUND = 'CAMERA_NOT_FOUND',
  CAMERA_BUSY = 'CAMERA_BUSY',
  CAMERA_DISCONNECTED = 'CAMERA_DISCONNECTED',
  CAPTURE_FAILED = 'CAPTURE_FAILED',

  // === Printer (Desktop Only) ===
  PRINTER_OFFLINE = 'PRINTER_OFFLINE',
  PRINTER_ERROR = 'PRINTER_ERROR',
  PRINT_JOB_FAILED = 'PRINT_JOB_FAILED',

  // === Gallery & Delivery ===
  GALLERY_NOT_FOUND = 'GALLERY_NOT_FOUND',
  GALLERY_EXPIRED = 'GALLERY_EXPIRED',
  GALLERY_TOKEN_INVALID = 'GALLERY_TOKEN_INVALID',
  EMAIL_DELIVERY_FAILED = 'EMAIL_DELIVERY_FAILED',
  EMAIL_INVALID_ADDRESS = 'EMAIL_INVALID_ADDRESS',
  STORAGE_UPLOAD_FAILED = 'STORAGE_UPLOAD_FAILED',

  // === System ===
  UPDATE_CHECK_FAILED = 'UPDATE_CHECK_FAILED',
}

// ============================================================
// API Response Types
// ============================================================

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type ApiResponse<T> =
  | { success: true; data: T; timestamp: string }
  | { success: false; error: ApiError; timestamp: string };

// ============================================================
// Pagination
// ============================================================

export interface PaginationParams {
  page?: number;   // Default: 1, minimum: 1
  limit?: number;  // Default: 20, maximum: 100
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================
// HTTP Error Class
// ============================================================

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
