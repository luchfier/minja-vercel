import { IPhotoboothApi } from '../services/api.interface';
import { ApiResponse, PaginatedResponse, PaginationParams } from '../types/api';
import { PackageItem, CalculatePriceRequest, CalculatePriceResponse } from '../types/package';
import {
  CreatePaymentResponse,
  PaymentStatusCheckResponse,
  PaymentMethod,
  CashConfirmationRequest,
  CashConfirmationResponse,
  CashAuditLogItem,
  CashPendingTransaction,
} from '../types/payment';
import { TemplateItem } from '../types/template';
import { PublicBrandingConfig, AdminThemeConfig } from '../types/theme';
import { ReportSummary, TransactionReportItem } from '../types/reports';
import { CustomerSession } from '../types/session';
import { VoucherItem, ValidateVoucherRequest, ValidateVoucherResponse } from '../types/voucher';
import { FontItem, StickerItem } from '../types/assets';
import { mockPackages, mockTemplates, mockAdminConfig, mockVouchers } from './mockData';

const STORAGE_KEYS = {
  SETTINGS: 'minja_kiosk_admin_settings',
  PACKAGES: 'minja_kiosk_admin_packages',
  TEMPLATES: 'minja_kiosk_admin_templates',
  PIN: 'minja_kiosk_admin_pin',
  VOUCHERS: 'minja_kiosk_admin_vouchers',
  TRANSACTIONS: 'minja_kiosk_transactions',
  CASH_AUDIT_LOGS: 'minja_kiosk_cash_audit_logs',
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {
    console.warn(`[MockApi] Gagal membaca storage ${key}:`, e);
  }
  return fallback;
}

function saveToStorage<T>(key: string, data: T): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(key, JSON.stringify(data));
    }
  } catch (e) {
    console.warn(`[MockApi] Gagal menyimpan storage ${key}:`, e);
    // If quota exceeded and saving templates, preserve metadata and slots without the heavy base64 payload
    if (key === STORAGE_KEYS.TEMPLATES && Array.isArray(data)) {
      try {
        const lightweight = (data as any[]).map((item) => ({
          ...item,
          frameUrl: item.frameUrl && item.frameUrl.length > 50000 ? '' : item.frameUrl,
          thumbnailUrl: item.thumbnailUrl && item.thumbnailUrl.length > 50000 ? '' : item.thumbnailUrl,
        }));
        localStorage.setItem(key, JSON.stringify(lightweight));
      } catch {
        // Safe ignore
      }
    }
  }
}

function sanitizePackages(pkgs: PackageItem[]): PackageItem[] {
  if (!Array.isArray(pkgs) || pkgs.length === 0) return [...mockPackages];
  return pkgs.map((p) => {
    let duration = p.durationSeconds || 180;
    if (p.id === 'pkg-reguler' && duration <= 120) duration = 180;
    if (p.id === 'pkg-premium' && duration <= 180) duration = 300;
    if (p.id === 'pkg-party' && duration <= 240) duration = 600;
    return {
      ...p,
      durationSeconds: duration,
      printCopies: p.printCopies || 1,
    };
  });
}

const defaultInitialTransactions: TransactionReportItem[] = [
  {
    id: 'tx-1',
    orderId: 'ORDER-MJ-782190',
    sessionCode: 'MJ-8921',
    packageName: 'Paket Studio Standard',
    paymentMethod: 'qris',
    subtotal: 45000,
    voucherCode: 'MINJA20',
    discountAmount: 9000,
    grossAmount: 36000,
    additionalPrints: 0,
    status: 'settlement',
    paymentType: 'QRIS Midtrans',
    createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    settlementTime: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
  },
  {
    id: 'tx-2',
    orderId: 'ORDER-MJ-782189',
    sessionCode: 'MJ-8920',
    packageName: 'Paket Quick Studio',
    paymentMethod: 'cash',
    subtotal: 30000,
    voucherCode: undefined,
    discountAmount: 0,
    grossAmount: 45000,
    additionalPrints: 1,
    status: 'settlement',
    paymentType: 'Tunai / Cash',
    confirmedBy: 'Kasir 01 (Admin)',
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    settlementTime: new Date(Date.now() - 44 * 60 * 1000).toISOString(),
  },
  {
    id: 'tx-3',
    orderId: 'ORDER-MJ-782188',
    sessionCode: 'MJ-8919',
    packageName: 'Paket VIP Group',
    paymentMethod: 'qris',
    subtotal: 100000,
    voucherCode: 'HEMAT10000',
    discountAmount: 10000,
    grossAmount: 90000,
    additionalPrints: 2,
    status: 'settlement',
    paymentType: 'QRIS Midtrans',
    createdAt: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
    settlementTime: new Date(Date.now() - 109 * 60 * 1000).toISOString(),
  },
  {
    id: 'tx-4',
    orderId: 'ORDER-MJ-782187',
    sessionCode: 'MJ-8918',
    packageName: 'Paket Studio Standard',
    paymentMethod: 'cash',
    subtotal: 45000,
    voucherCode: undefined,
    discountAmount: 0,
    grossAmount: 45000,
    additionalPrints: 0,
    status: 'pending',
    paymentType: 'Tunai / Cash',
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: 'tx-5',
    orderId: 'ORDER-MJ-782186',
    sessionCode: 'MJ-8917',
    packageName: 'Paket Quick Studio',
    paymentMethod: 'qris',
    subtotal: 30000,
    voucherCode: undefined,
    discountAmount: 0,
    grossAmount: 30000,
    additionalPrints: 0,
    status: 'expire',
    paymentType: 'QRIS Midtrans',
    createdAt: new Date(Date.now() - 240 * 60 * 1000).toISOString(),
  },
  {
    id: 'tx-6',
    orderId: 'ORDER-MJ-782185',
    sessionCode: 'MJ-8916',
    packageName: 'Paket Studio Standard',
    paymentMethod: 'cash',
    subtotal: 45000,
    voucherCode: 'HEMAT10000',
    discountAmount: 10000,
    grossAmount: 35000,
    additionalPrints: 0,
    status: 'cancel',
    paymentType: 'Tunai / Cash',
    createdAt: new Date(Date.now() - 320 * 60 * 1000).toISOString(),
  },
];

const defaultInitialCashLogs: CashAuditLogItem[] = [
  {
    id: 'audit-001',
    orderId: 'ORDER-MJ-782189',
    operatorId: 'Kasir 01 (Admin)',
    grossAmount: 45000,
    receivedAmount: 50000,
    changeAmount: 5000,
    timestamp: new Date(Date.now() - 44 * 60 * 1000).toISOString(),
    note: 'Uang pas diterima lembar Rp 50.000',
  },
];

export class MockPhotoboothApi implements IPhotoboothApi {
  private currentOrderId: string = '';
  private currentSessionPackage: PackageItem | null = null;
  private currentSessionAdditionalPrints: number = 0;
  private pollCount: number = 0;
  private forcedSettlement: boolean = false;

  private adminPin: string = loadFromStorage(STORAGE_KEYS.PIN, '123456');
  private adminPackages: PackageItem[] = sanitizePackages(
    loadFromStorage(STORAGE_KEYS.PACKAGES, [...mockPackages])
  );
  private adminTemplates: TemplateItem[] = loadFromStorage(STORAGE_KEYS.TEMPLATES, [...mockTemplates]);
  private adminSettings: AdminThemeConfig = loadFromStorage(STORAGE_KEYS.SETTINGS, { ...mockAdminConfig });
  private adminVouchers: VoucherItem[] = loadFromStorage(STORAGE_KEYS.VOUCHERS, [...mockVouchers]);
  private transactions: TransactionReportItem[] = loadFromStorage(STORAGE_KEYS.TRANSACTIONS, defaultInitialTransactions);
  private cashAuditLogs: CashAuditLogItem[] = loadFromStorage(STORAGE_KEYS.CASH_AUDIT_LOGS, defaultInitialCashLogs);

  async getPublicSettings(): Promise<ApiResponse<PublicBrandingConfig>> {
    return {
      success: true,
      data: {
        boothName: this.adminSettings.boothName,
        tagline: this.adminSettings.tagline,
        logoUrl: this.adminSettings.logoUrl,
        wallpaperUrl: this.adminSettings.wallpaperUrl,
        welcomeHeadline: this.adminSettings.welcomeHeadline,
        welcomeSubheadline: this.adminSettings.welcomeSubheadline,
        startSessionButtonText: this.adminSettings.startSessionButtonText,
        primaryColor: this.adminSettings.primaryColor,
        accentColor: this.adminSettings.accentColor,
        darkSurfaceColor: this.adminSettings.darkSurfaceColor,
        backgroundBlur: this.adminSettings.backgroundBlur,
        backgroundOverlayOpacity: this.adminSettings.backgroundOverlayOpacity,
        backgroundFit: this.adminSettings.backgroundFit,
        backgroundOpacity: this.adminSettings.backgroundOpacity,
        logoHeight: this.adminSettings.logoHeight,
        glassmorphismIntensity: this.adminSettings.glassmorphismIntensity,
        enableVignette: this.adminSettings.enableVignette,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async getPackages(): Promise<ApiResponse<PackageItem[]>> {
    return {
      success: true,
      data: this.adminPackages.filter((p) => p.isActive),
      timestamp: new Date().toISOString(),
    };
  }

  async validateVoucher(req: ValidateVoucherRequest): Promise<ApiResponse<ValidateVoucherResponse>> {
    const cleanCode = (req.code || '').trim().toUpperCase();
    if (!cleanCode) {
      return {
        success: true,
        data: { isValid: false, errorMessage: 'Silakan masukkan kode voucher.', errorCode: 'VOUCHER_NOT_FOUND' },
        timestamp: new Date().toISOString(),
      };
    }

    const voucher = this.adminVouchers.find((v) => v.code.toUpperCase() === cleanCode);
    if (!voucher) {
      return {
        success: true,
        data: {
          isValid: false,
          errorMessage: `Kode voucher "${cleanCode}" tidak ditemukan. Periksa kembali ejaan voucher.`,
          errorCode: 'VOUCHER_NOT_FOUND',
        },
        timestamp: new Date().toISOString(),
      };
    }

    if (!voucher.isActive) {
      return {
        success: true,
        data: {
          isValid: false,
          errorMessage: `Voucher "${voucher.name}" saat ini sedang dinonaktifkan oleh admin.`,
          errorCode: 'VOUCHER_INACTIVE',
        },
        timestamp: new Date().toISOString(),
      };
    }

    const now = new Date();
    if (now < new Date(voucher.validFrom) || now > new Date(voucher.validUntil)) {
      return {
        success: true,
        data: {
          isValid: false,
          errorMessage: 'Masa berlaku voucher telah berakhir (kedaluwarsa).',
          errorCode: 'VOUCHER_EXPIRED',
        },
        timestamp: new Date().toISOString(),
      };
    }

    if (voucher.usedCount >= voucher.quota) {
      return {
        success: true,
        data: {
          isValid: false,
          errorMessage: 'Kuota penukaran voucher ini telah habis digunakan.',
          errorCode: 'VOUCHER_QUOTA_EXCEEDED',
        },
        timestamp: new Date().toISOString(),
      };
    }

    if (voucher.minTransaction && req.subtotal < voucher.minTransaction) {
      const minFormatted = 'Rp ' + voucher.minTransaction.toLocaleString('id-ID');
      return {
        success: true,
        data: {
          isValid: false,
          errorMessage: `Minimal transaksi belanja ${minFormatted} untuk menggunakan voucher ini.`,
          errorCode: 'VOUCHER_MIN_NOT_MET',
        },
        timestamp: new Date().toISOString(),
      };
    }

    if (voucher.applicablePackageIds && voucher.applicablePackageIds.length > 0) {
      if (!voucher.applicablePackageIds.includes(req.packageId)) {
        return {
          success: true,
          data: {
            isValid: false,
            errorMessage: 'Voucher ini hanya berlaku untuk paket promosi tertentu.',
            errorCode: 'VOUCHER_PACKAGE_NOT_ELIGIBLE',
          },
          timestamp: new Date().toISOString(),
        };
      }
    }

    let calculatedDiscount = 0;
    if (voucher.type === 'percentage') {
      calculatedDiscount = Math.round(req.subtotal * (voucher.discountValue / 100));
      if (voucher.maxDiscount) {
        calculatedDiscount = Math.min(calculatedDiscount, voucher.maxDiscount);
      }
    } else {
      calculatedDiscount = Math.min(voucher.discountValue, req.subtotal);
    }

    return {
      success: true,
      data: {
        isValid: true,
        voucher: {
          code: voucher.code,
          name: voucher.name,
          type: voucher.type,
          discountValue: voucher.discountValue,
          discountAmount: calculatedDiscount,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  async calculatePrice(req: CalculatePriceRequest): Promise<ApiResponse<CalculatePriceResponse>> {
    const pkg = this.adminPackages.find((p) => p.id === req.packageId);
    if (!pkg) {
      return {
        success: false,
        error: { code: 'PACKAGE_NOT_FOUND', message: 'Paket tidak ditemukan' },
        timestamp: new Date().toISOString(),
      };
    }

    const unitPrice = pkg.additionalPrintPrice ?? 15000;
    const additionalTotal = Math.max(0, req.additionalPrints || 0) * unitPrice;
    const subtotal = pkg.price + additionalTotal;

    let discountAmount = 0;
    let voucherCode: string | undefined = undefined;
    let voucherName: string | undefined = undefined;
    let voucherError: string | undefined = undefined;

    if (req.voucherCode && req.voucherCode.trim()) {
      const vRes = await this.validateVoucher({
        code: req.voucherCode,
        packageId: pkg.id,
        subtotal,
      });

      if (vRes.success && vRes.data.isValid && vRes.data.voucher) {
        discountAmount = vRes.data.voucher.discountAmount;
        voucherCode = vRes.data.voucher.code;
        voucherName = vRes.data.voucher.name;
      } else if (vRes.success && !vRes.data.isValid) {
        voucherError = vRes.data.errorMessage || 'Voucher tidak valid.';
      } else if (!vRes.success) {
        voucherError = vRes.error.message;
      }
    }

    const gross = Math.max(0, subtotal - discountAmount);

    return {
      success: true,
      data: {
        packageId: pkg.id,
        packageName: pkg.name,
        basePrice: pkg.price,
        additionalPrints: req.additionalPrints || 0,
        additionalPrintUnitPrice: unitPrice,
        additionalPrintTotal: additionalTotal,
        subtotal,
        voucherCode,
        voucherName,
        discountAmount,
        grossAmount: gross,
        voucherError,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async createSession(packageId: string): Promise<ApiResponse<CustomerSession>> {
    const pkg = this.adminPackages.find((p) => p.id === packageId) || this.adminPackages[0];
    const sessionCode = 'MJ-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    const sessionId = 'ses_' + Math.random().toString(36).substring(2, 9);

    this.currentSessionPackage = pkg;
    this.currentSessionAdditionalPrints = 0;

    const session: CustomerSession = {
      sessionId,
      sessionCode,
      state: 'PACKAGE_SELECTION',
      package: pkg,
      photos: [],
      selectedPhotoIds: [],
      additionalPrints: 0,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };

    return {
      success: true,
      data: session,
      timestamp: new Date().toISOString(),
    };
  }

  async createPayment(
    _sessionId: string,
    paymentMethod: PaymentMethod = 'qris',
    voucherCode?: string
  ): Promise<ApiResponse<CreatePaymentResponse>> {
    this.currentOrderId = 'ORDER-MJ-' + Math.floor(100000 + Math.random() * 900000);
    this.pollCount = 0;
    this.forcedSettlement = false;

    const pkg = this.currentSessionPackage || this.adminPackages[0];
    const unitPrice = pkg.additionalPrintPrice ?? 15000;
    const additionalTotal = this.currentSessionAdditionalPrints * unitPrice;
    const subtotal = pkg.price + additionalTotal;

    let discountAmount = 0;
    let appliedVoucherCode: string | undefined = undefined;

    if (voucherCode && voucherCode.trim()) {
      const vRes = await this.validateVoucher({
        code: voucherCode,
        packageId: pkg.id,
        subtotal,
      });
      if (vRes.success && vRes.data.isValid && vRes.data.voucher) {
        discountAmount = vRes.data.voucher.discountAmount;
        appliedVoucherCode = vRes.data.voucher.code;

        // Increment used count in memory and storage
        const vIndex = this.adminVouchers.findIndex((v) => v.code === appliedVoucherCode);
        if (vIndex !== -1) {
          this.adminVouchers[vIndex].usedCount++;
          saveToStorage(STORAGE_KEYS.VOUCHERS, this.adminVouchers);
        }
      }
    }

    const gross = Math.max(0, subtotal - discountAmount);

    // Save pending transaction to transactions history
    const newTx: TransactionReportItem = {
      id: 'tx-' + Math.random().toString(36).substring(2, 8),
      orderId: this.currentOrderId,
      sessionCode: 'MJ-' + Math.floor(1000 + Math.random() * 9000),
      packageName: pkg.name,
      paymentMethod,
      subtotal,
      voucherCode: appliedVoucherCode,
      discountAmount,
      grossAmount: gross,
      additionalPrints: this.currentSessionAdditionalPrints,
      status: 'pending',
      paymentType: paymentMethod === 'cash' ? 'Tunai / Cash' : 'QRIS Midtrans',
      createdAt: new Date().toISOString(),
    };
    this.transactions.unshift(newTx);
    saveToStorage(STORAGE_KEYS.TRANSACTIONS, this.transactions);

    if (paymentMethod === 'cash') {
      return {
        success: true,
        data: {
          paymentId: 'pay_' + Math.random().toString(36).substring(2, 9),
          orderId: this.currentOrderId,
          paymentMethod: 'cash',
          basePrice: pkg.price,
          additionalPrintsTotal: additionalTotal,
          voucherCode: appliedVoucherCode,
          discountAmount,
          grossAmount: gross,
          expiryTime: new Date(Date.now() + 600 * 1000).toISOString(),
          status: 'pending',
          cashDetails: {
            cashierNote: 'Menunggu pembayaran dan konfirmasi petugas di kasir',
          },
        },
        timestamp: new Date().toISOString(),
      };
    }

    // QRIS Flow
    const qrString = `00020101021226670016ID.CO.MIDTRANS.WWW01189360091800000000000215${this.currentOrderId}51450015ID.OR.GPN.WWW02150000000000000005204581253033605405500005802ID5915MINJA PHOTOBOOTH6007JAKARTA61051234062070703A0163041A2F`;

    return {
      success: true,
      data: {
        paymentId: 'pay_' + Math.random().toString(36).substring(2, 9),
        orderId: this.currentOrderId,
        paymentMethod: 'qris',
        qrString,
        basePrice: pkg.price,
        additionalPrintsTotal: additionalTotal,
        voucherCode: appliedVoucherCode,
        discountAmount,
        grossAmount: gross,
        expiryTime: new Date(Date.now() + 180 * 1000).toISOString(),
        status: 'pending',
      },
      timestamp: new Date().toISOString(),
    };
  }

  async createExtraPrintsPayment(
    _sessionId: string,
    additionalPrints: number,
    paymentMethod: PaymentMethod = 'qris'
  ): Promise<ApiResponse<CreatePaymentResponse>> {
    this.currentOrderId = 'ORDER-EXT-' + Math.floor(100000 + Math.random() * 900000);
    this.pollCount = 0;
    this.forcedSettlement = false;

    const pkg = this.currentSessionPackage || this.adminPackages[0];
    const unitPrice = pkg.additionalPrintPrice ?? 15000;
    const gross = additionalPrints * unitPrice;

    const newTx: TransactionReportItem = {
      id: 'tx-' + Math.random().toString(36).substring(2, 8),
      orderId: this.currentOrderId,
      sessionCode: 'MJ-' + Math.floor(1000 + Math.random() * 9000),
      packageName: `Extra Prints (+${additionalPrints})`,
      paymentMethod,
      subtotal: gross,
      discountAmount: 0,
      grossAmount: gross,
      additionalPrints,
      status: 'pending',
      paymentType: paymentMethod === 'cash' ? 'Tunai / Cash' : 'QRIS Midtrans',
      createdAt: new Date().toISOString(),
    };
    this.transactions.unshift(newTx);
    saveToStorage(STORAGE_KEYS.TRANSACTIONS, this.transactions);

    const qrString = `00020101021226670016ID.CO.MIDTRANS.WWW01189360091800000000000215${this.currentOrderId}51450015ID.OR.GPN.WWW02150000000000000005204581253033605405500005802ID5915MINJA PHOTOBOOTH6007JAKARTA61051234062070703A0163041A2F`;

    return {
      success: true,
      data: {
        paymentId: 'pay_' + Math.random().toString(36).substring(2, 9),
        orderId: this.currentOrderId,
        paymentMethod,
        qrString: paymentMethod === 'qris' ? qrString : undefined,
        basePrice: 0,
        additionalPrintsTotal: gross,
        discountAmount: 0,
        grossAmount: gross,
        expiryTime: new Date(Date.now() + 180 * 1000).toISOString(),
        status: 'pending',
      },
      timestamp: new Date().toISOString(),
    };
  }

  triggerPaymentSuccess() {
    this.forcedSettlement = true;
  }

  async checkPaymentStatus(orderId: string): Promise<ApiResponse<PaymentStatusCheckResponse>> {
    this.pollCount++;
    const tx = this.transactions.find((t) => t.orderId === orderId);

    if (!tx) {
      return {
        success: false,
        error: { code: 'PAYMENT_NOT_FOUND', message: 'Order tidak ditemukan' },
        timestamp: new Date().toISOString(),
      };
    }

    // Cash payments are strictly settled only when confirmed by admin/cashier
    if (tx.paymentMethod === 'cash') {
      const isSettled = tx.status === 'settlement';
      return {
        success: true,
        data: {
          orderId,
          paymentMethod: 'cash',
          transactionStatus: tx.status,
          isVerified: isSettled,
          basePrice: tx.subtotal,
          discountAmount: tx.discountAmount,
          grossAmount: tx.grossAmount,
          paymentType: 'Tunai / Cash',
          settlementTime: tx.settlementTime,
          cashDetails: {
            confirmedBy: tx.confirmedBy,
            confirmedAt: tx.settlementTime,
          },
        },
        timestamp: new Date().toISOString(),
      };
    }

    // QRIS simulation
    const isSettled = this.forcedSettlement || this.pollCount >= 6 || tx.status === 'settlement';
    if (isSettled && tx.status !== 'settlement') {
      tx.status = 'settlement';
      tx.settlementTime = new Date().toISOString();
      saveToStorage(STORAGE_KEYS.TRANSACTIONS, this.transactions);
    }

    return {
      success: true,
      data: {
        orderId,
        paymentMethod: 'qris',
        transactionStatus: tx.status,
        isVerified: tx.status === 'settlement',
        basePrice: tx.subtotal,
        discountAmount: tx.discountAmount,
        grossAmount: tx.grossAmount,
        paymentType: 'QRIS Midtrans',
        settlementTime: tx.settlementTime,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async forcePaymentSettlement(orderId?: string): Promise<ApiResponse<PaymentStatusCheckResponse>> {
    this.forcedSettlement = true;
    const targetId = orderId || this.currentOrderId;
    const tx = this.transactions.find((t) => t.orderId === targetId);
    if (tx) {
      tx.status = 'settlement';
      tx.settlementTime = new Date().toISOString();
      saveToStorage(STORAGE_KEYS.TRANSACTIONS, this.transactions);
    }
    return this.checkPaymentStatus(targetId);
  }

  async confirmCashPayment(
    _token: string,
    req: CashConfirmationRequest
  ): Promise<ApiResponse<CashConfirmationResponse>> {
    // 1. PIN verification
    if (req.adminPin !== this.adminPin) {
      return {
        success: false,
        error: { code: 'INVALID_PIN', message: 'PIN Admin tidak valid. Konfirmasi ditolak.' },
        timestamp: new Date().toISOString(),
      };
    }

    // 2. Transaction lookup
    const txIndex = this.transactions.findIndex((t) => t.orderId === req.orderId);
    if (txIndex === -1) {
      return {
        success: false,
        error: { code: 'PAYMENT_NOT_FOUND', message: 'Transaksi tidak ditemukan.' },
        timestamp: new Date().toISOString(),
      };
    }

    const tx = this.transactions[txIndex];
    if (tx.status === 'settlement') {
      return {
        success: false,
        error: { code: 'PAYMENT_ALREADY_SETTLED', message: 'Transaksi ini sudah selesai dikonfirmasi.' },
        timestamp: new Date().toISOString(),
      };
    }

    // 3. Amount verification
    if (req.receivedAmount < tx.grossAmount) {
      const kur = tx.grossAmount - req.receivedAmount;
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Uang yang diterima kurang Rp ${kur.toLocaleString('id-ID')}. Total tagihan: Rp ${tx.grossAmount.toLocaleString('id-ID')}.`,
        },
        timestamp: new Date().toISOString(),
      };
    }

    const changeAmount = req.receivedAmount - tx.grossAmount;
    const operatorId = req.operatorId || 'Petugas 01 (Admin)';
    const confirmedAt = new Date().toISOString();

    // 4. Update transaction
    tx.status = 'settlement';
    tx.confirmedBy = operatorId;
    tx.settlementTime = confirmedAt;
    saveToStorage(STORAGE_KEYS.TRANSACTIONS, this.transactions);

    // 5. Append Cash Audit Log (Never record PIN)
    const auditLog: CashAuditLogItem = {
      id: 'audit-' + Math.random().toString(36).substring(2, 8),
      orderId: tx.orderId,
      operatorId,
      grossAmount: tx.grossAmount,
      receivedAmount: req.receivedAmount,
      changeAmount,
      timestamp: confirmedAt,
      note: req.cashierNote || 'Pembayaran tunai lunas di loket',
    };
    this.cashAuditLogs.unshift(auditLog);
    saveToStorage(STORAGE_KEYS.CASH_AUDIT_LOGS, this.cashAuditLogs);

    return {
      success: true,
      data: {
        orderId: tx.orderId,
        status: 'settlement',
        grossAmount: tx.grossAmount,
        receivedAmount: req.receivedAmount,
        changeAmount,
        confirmedBy: operatorId,
        confirmedAt,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async getCashPendingTransactions(_token: string): Promise<ApiResponse<CashPendingTransaction[]>> {
    const pendings: CashPendingTransaction[] = this.transactions
      .filter((t) => t.paymentMethod === 'cash' && t.status === 'pending')
      .map((t) => ({
        id: t.id,
        orderId: t.orderId,
        sessionCode: t.sessionCode,
        packageName: t.packageName,
        paymentMethod: 'cash',
        subtotal: t.subtotal,
        voucherCode: t.voucherCode,
        discountAmount: t.discountAmount,
        grossAmount: t.grossAmount,
        status: 'pending',
        createdAt: t.createdAt,
        expiresAt: new Date(new Date(t.createdAt).getTime() + 15 * 60 * 1000).toISOString(),
      }));

    return {
      success: true,
      data: pendings,
      timestamp: new Date().toISOString(),
    };
  }

  async getCashAuditLogs(_token: string): Promise<ApiResponse<CashAuditLogItem[]>> {
    return {
      success: true,
      data: [...this.cashAuditLogs],
      timestamp: new Date().toISOString(),
    };
  }

  async cancelSession(_sessionId: string): Promise<ApiResponse<{ cancelled: boolean }>> {
    if (this.currentOrderId) {
      const tx = this.transactions.find((t) => t.orderId === this.currentOrderId);
      if (tx && tx.status === 'pending') {
        tx.status = 'cancel';
        saveToStorage(STORAGE_KEYS.TRANSACTIONS, this.transactions);
      }
    }
    return {
      success: true,
      data: { cancelled: true },
      timestamp: new Date().toISOString(),
    };
  }

  async completeSession(
    sessionId: string,
    _selectedPhotoIds: string[],
    _templateId?: string
  ): Promise<ApiResponse<{ success: boolean; sessionCode: string }>> {
    return {
      success: true,
      data: {
        success: true,
        sessionCode: 'MJ-' + sessionId.slice(-4).toUpperCase(),
      },
      timestamp: new Date().toISOString(),
    };
  }

  async getTemplates(): Promise<ApiResponse<TemplateItem[]>> {
    return {
      success: true,
      data: this.adminTemplates.filter((t) => t.isActive),
      timestamp: new Date().toISOString(),
    };
  }

  async sendEmail(_sessionId: string, _email: string): Promise<ApiResponse<{ sent: boolean; messageId: string }>> {
    return {
      success: true,
      data: {
        sent: true,
        messageId: 'email_' + Math.random().toString(36).substring(2, 9),
      },
      timestamp: new Date().toISOString(),
    };
  }

  async getGalleryUrl(sessionId: string): Promise<ApiResponse<{ qrString: string; galleryUrl: string; expiresAt: string }>> {
    const token = 'tok_' + Math.random().toString(36).substring(2, 10);
    const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
    const galleryUrl = `http://${host}:3000/s/${sessionId}?token=${token}`;
    return {
      success: true,
      data: {
        qrString: galleryUrl,
        galleryUrl,
        expiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      },
      timestamp: new Date().toISOString(),
    };
  }

  async loginAdmin(pin: string): Promise<ApiResponse<{ token: string; expiresIn: number }>> {
    if (pin === this.adminPin) {
      return {
        success: true,
        data: {
          token: 'mock-jwt-admin-token-' + Date.now(),
          expiresIn: 3600,
        },
        timestamp: new Date().toISOString(),
      };
    }
    return {
      success: false,
      error: { code: 'INVALID_PIN', message: 'PIN Admin tidak valid' },
      timestamp: new Date().toISOString(),
    };
  }

  async changePin(_token: string, currentPin: string, newPin: string): Promise<ApiResponse<{ message: string }>> {
    if (currentPin !== this.adminPin) {
      return {
        success: false,
        error: { code: 'INVALID_PIN', message: 'PIN saat ini salah' },
        timestamp: new Date().toISOString(),
      };
    }
    this.adminPin = newPin;
    saveToStorage(STORAGE_KEYS.PIN, this.adminPin);
    return {
      success: true,
      data: { message: 'PIN berhasil diubah' },
      timestamp: new Date().toISOString(),
    };
  }

  async getAdminSettings(_token: string): Promise<ApiResponse<AdminThemeConfig>> {
    return {
      success: true,
      data: { ...this.adminSettings },
      timestamp: new Date().toISOString(),
    };
  }

  async updateAdminSettings(_token: string, settings: Partial<AdminThemeConfig>): Promise<ApiResponse<AdminThemeConfig>> {
    Object.assign(this.adminSettings, settings);
    saveToStorage(STORAGE_KEYS.SETTINGS, this.adminSettings);
    return {
      success: true,
      data: { ...this.adminSettings },
      timestamp: new Date().toISOString(),
    };
  }

  async getAdminPackages(_token: string): Promise<ApiResponse<PackageItem[]>> {
    return {
      success: true,
      data: [...this.adminPackages],
      timestamp: new Date().toISOString(),
    };
  }

  async createPackage(_token: string, pkg: Omit<PackageItem, 'id'>): Promise<ApiResponse<PackageItem>> {
    const newPkg: PackageItem = {
      ...pkg,
      id: 'pkg-' + Math.random().toString(36).substring(2, 7),
    };
    this.adminPackages.push(newPkg);
    saveToStorage(STORAGE_KEYS.PACKAGES, this.adminPackages);
    return {
      success: true,
      data: newPkg,
      timestamp: new Date().toISOString(),
    };
  }

  async updatePackage(_token: string, id: string, pkg: Partial<PackageItem>): Promise<ApiResponse<PackageItem>> {
    const index = this.adminPackages.findIndex((p) => p.id === id);
    if (index === -1) {
      return {
        success: false,
        error: { code: 'PACKAGE_NOT_FOUND', message: 'Paket tidak ditemukan' },
        timestamp: new Date().toISOString(),
      };
    }
    this.adminPackages[index] = { ...this.adminPackages[index], ...pkg };
    saveToStorage(STORAGE_KEYS.PACKAGES, this.adminPackages);
    return {
      success: true,
      data: this.adminPackages[index],
      timestamp: new Date().toISOString(),
    };
  }

  async deletePackage(_token: string, id: string): Promise<ApiResponse<{ message: string }>> {
    const index = this.adminPackages.findIndex((p) => p.id === id);
    if (index !== -1) {
      this.adminPackages[index].isActive = false;
      saveToStorage(STORAGE_KEYS.PACKAGES, this.adminPackages);
    }
    return {
      success: true,
      data: { message: 'Paket dinonaktifkan' },
      timestamp: new Date().toISOString(),
    };
  }

  async getAdminTemplates(_token: string): Promise<ApiResponse<TemplateItem[]>> {
    return {
      success: true,
      data: [...this.adminTemplates],
      timestamp: new Date().toISOString(),
    };
  }

  async createTemplate(_token: string, tpl: Omit<TemplateItem, 'id'>): Promise<ApiResponse<TemplateItem>> {
    const newTpl: TemplateItem = {
      ...tpl,
      id: 'tpl-' + Math.random().toString(36).substring(2, 9),
    };
    this.adminTemplates.unshift(newTpl);
    saveToStorage(STORAGE_KEYS.TEMPLATES, this.adminTemplates);
    return {
      success: true,
      data: newTpl,
      timestamp: new Date().toISOString(),
    };
  }

  async updateTemplate(_token: string, id: string, tpl: Partial<TemplateItem>): Promise<ApiResponse<TemplateItem>> {
    const index = this.adminTemplates.findIndex((t) => t.id === id);
    if (index === -1) {
      const newTpl: TemplateItem = {
        id,
        name: tpl.name || 'Template Frame',
        thumbnailUrl: tpl.thumbnailUrl || '',
        frameUrl: tpl.frameUrl || '',
        layoutType: tpl.layoutType || '4R_PORTRAIT',
        width: tpl.width || 1200,
        height: tpl.height || 1800,
        isActive: tpl.isActive ?? true,
        isDefault: tpl.isDefault ?? false,
        slots: tpl.slots || [],
      };
      this.adminTemplates.unshift(newTpl);
      saveToStorage(STORAGE_KEYS.TEMPLATES, this.adminTemplates);
      return {
        success: true,
        data: newTpl,
        timestamp: new Date().toISOString(),
      };
    }
    this.adminTemplates[index] = { ...this.adminTemplates[index], ...tpl };
    saveToStorage(STORAGE_KEYS.TEMPLATES, this.adminTemplates);
    return {
      success: true,
      data: this.adminTemplates[index],
      timestamp: new Date().toISOString(),
    };
  }

  async deleteTemplate(_token: string, id: string): Promise<ApiResponse<{ message: string }>> {
    const index = this.adminTemplates.findIndex((t) => t.id === id);
    if (index !== -1) {
      this.adminTemplates.splice(index, 1);
      saveToStorage(STORAGE_KEYS.TEMPLATES, this.adminTemplates);
    }
    return {
      success: true,
      data: { message: 'Template berhasil dihapus permanen' },
      timestamp: new Date().toISOString(),
    };
  }

  // Admin Voucher Endpoints
  async getAdminVouchers(_token: string): Promise<ApiResponse<VoucherItem[]>> {
    return {
      success: true,
      data: [...this.adminVouchers],
      timestamp: new Date().toISOString(),
    };
  }

  async createVoucher(_token: string, voucher: Omit<VoucherItem, 'id' | 'usedCount' | 'createdAt'>): Promise<ApiResponse<VoucherItem>> {
    const newVoucher: VoucherItem = {
      ...voucher,
      id: 'vch-' + Math.random().toString(36).substring(2, 8),
      code: voucher.code.trim().toUpperCase(),
      usedCount: 0,
      createdAt: new Date().toISOString(),
    };
    this.adminVouchers.unshift(newVoucher);
    saveToStorage(STORAGE_KEYS.VOUCHERS, this.adminVouchers);
    return {
      success: true,
      data: newVoucher,
      timestamp: new Date().toISOString(),
    };
  }

  async updateVoucher(_token: string, id: string, voucher: Partial<VoucherItem>): Promise<ApiResponse<VoucherItem>> {
    const index = this.adminVouchers.findIndex((v) => v.id === id);
    if (index === -1) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Voucher tidak ditemukan' },
        timestamp: new Date().toISOString(),
      };
    }
    if (voucher.code) {
      voucher.code = voucher.code.trim().toUpperCase();
    }
    this.adminVouchers[index] = { ...this.adminVouchers[index], ...voucher };
    saveToStorage(STORAGE_KEYS.VOUCHERS, this.adminVouchers);
    return {
      success: true,
      data: this.adminVouchers[index],
      timestamp: new Date().toISOString(),
    };
  }

  async deleteVoucher(_token: string, id: string): Promise<ApiResponse<{ message: string }>> {
    const index = this.adminVouchers.findIndex((v) => v.id === id);
    if (index !== -1) {
      this.adminVouchers[index].isActive = false;
      saveToStorage(STORAGE_KEYS.VOUCHERS, this.adminVouchers);
    }
    return {
      success: true,
      data: { message: 'Voucher dinonaktifkan' },
      timestamp: new Date().toISOString(),
    };
  }

  async getReportsSummary(_token: string): Promise<ApiResponse<ReportSummary>> {
    const settled = this.transactions.filter((t) => t.status === 'settlement');
    const totalRevenue = settled.reduce((acc, t) => acc + t.grossAmount, 0);
    const qrisRevenue = settled
      .filter((t) => t.paymentMethod === 'qris')
      .reduce((acc, t) => acc + t.grossAmount, 0);
    const cashRevenue = settled
      .filter((t) => t.paymentMethod === 'cash')
      .reduce((acc, t) => acc + t.grossAmount, 0);
    const totalDiscountGiven = settled.reduce((acc, t) => acc + (t.discountAmount || 0), 0);
    const totalPrints = settled.reduce((acc, t) => acc + (t.additionalPrints || 0) + 1, 0);

    return {
      success: true,
      data: {
        totalRevenue,
        qrisRevenue,
        cashRevenue,
        totalDiscountGiven,
        totalSessions: this.transactions.length,
        completedSessions: settled.length,
        failedSessions: this.transactions.filter((t) => t.status === 'cancel' || t.status === 'expire').length,
        totalPrints,
        averageSessionDurationSeconds: 245,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async getTransactions(_token: string, _params?: PaginationParams): Promise<ApiResponse<PaginatedResponse<TransactionReportItem>>> {
    return {
      success: true,
      data: {
        items: [...this.transactions],
        total: this.transactions.length,
        page: 1,
        limit: 100,
        totalPages: 1,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async exportTransactionsCsv(_token: string, _params?: { startDate?: string; endDate?: string }): Promise<string> {
    const items = [...this.transactions];
    const headers = [
      'Order ID',
      'Waktu Transaksi',
      'Nama Paket',
      'Metode Pembayaran',
      'Harga Sebelum Diskon (IDR)',
      'Kode Voucher',
      'Nilai Diskon (IDR)',
      'Total Dibayar (IDR)',
      'Status Transaksi',
      'Petugas Konfirmasi Cash',
    ];

    const rows = items.map((i) => [
      `"${i.orderId}"`,
      `"${new Date(i.createdAt).toLocaleString('id-ID')}"`,
      `"${i.packageName}"`,
      `"${i.paymentMethod === 'cash' ? 'Tunai / Cash' : 'QRIS Midtrans'}"`,
      i.subtotal,
      `"${i.voucherCode || '-'}"`,
      i.discountAmount || 0,
      i.grossAmount,
      `"${i.status.toUpperCase()}"`,
      `"${i.confirmedBy || '-'}"`,
    ]);

    return '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  }

  // Assets (Fonts & Stickers) Mock Implementation
  private fonts: FontItem[] = [
    { id: 'plus-jakarta-sans', name: 'Modern Studio', fontFamily: 'Plus Jakarta Sans', googleFont: 'Plus Jakarta Sans:wght@400;700;800', previewText: 'Modern Studio', isActive: true },
    { id: 'playfair-display', name: 'Playfair Elegan', fontFamily: 'Playfair Display', googleFont: 'Playfair Display:ital,wght@0,600;0,800;1,600', previewText: 'Elegan & Anggun', isActive: true },
    { id: 'dancing-script', name: 'Dancing Script', fontFamily: 'Dancing Script', googleFont: 'Dancing Script:wght@700', previewText: 'Tulisan Sambung', isActive: true },
    { id: 'montserrat', name: 'Montserrat Bold', fontFamily: 'Montserrat', googleFont: 'Montserrat:wght@800;900', previewText: 'Tegas & Modern', isActive: true },
    { id: 'pacifico', name: 'Pacifico Fun', fontFamily: 'Pacifico', googleFont: 'Pacifico', previewText: 'Ceria & Santai', isActive: true },
    { id: 'oswald', name: 'Oswald Solid', fontFamily: 'Oswald', googleFont: 'Oswald:wght@700', previewText: 'Statement Kuat', isActive: true },
    { id: 'caveat', name: 'Caveat Santai', fontFamily: 'Caveat', googleFont: 'Caveat:wght@700', previewText: 'Coretan Alami', isActive: true },
    { id: 'cinzel', name: 'Cinzel Klasik', fontFamily: 'Cinzel', googleFont: 'Cinzel:wght@700', previewText: 'Klasik Istimewa', isActive: true },
  ];

  private stickers: StickerItem[] = [
    { id: 'stk-heart', name: 'Red Heart', category: 'Emoji', type: 'emoji', url: '❤️', isActive: true },
    { id: 'stk-sparkles', name: 'Sparkles', category: 'Emoji', type: 'emoji', url: '✨', isActive: true },
    { id: 'stk-cool', name: 'Cool Sunglasses', category: 'Emoji', type: 'emoji', url: '😎', isActive: true },
    { id: 'stk-party', name: 'Party Popper', category: 'Emoji', type: 'emoji', url: '🎉', isActive: true },
    { id: 'stk-crown', name: 'Gold Crown', category: 'Emoji', type: 'emoji', url: '👑', isActive: true },
    { id: 'stk-camera', name: 'Vintage Camera', category: 'Emoji', type: 'emoji', url: '📷', isActive: true },
    { id: 'stk-butterfly', name: 'Butterfly', category: 'Emoji', type: 'emoji', url: '🦋', isActive: true },
    { id: 'stk-ribbon', name: 'Pink Ribbon', category: 'Emoji', type: 'emoji', url: '🎀', isActive: true },
    { id: 'stk-flame', name: 'Flame Hits', category: 'Emoji', type: 'emoji', url: '🔥', isActive: true },
    { id: 'stk-peace', name: 'Peace Sign', category: 'Emoji', type: 'emoji', url: '✌️', isActive: true },
  ];

  async getPublicFonts(): Promise<ApiResponse<FontItem[]>> {
    return { success: true, data: this.fonts.filter(f => f.isActive), timestamp: new Date().toISOString() };
  }

  async getPublicStickers(): Promise<ApiResponse<StickerItem[]>> {
    return { success: true, data: this.stickers.filter(s => s.isActive), timestamp: new Date().toISOString() };
  }

  async getAdminFonts(_token: string): Promise<ApiResponse<FontItem[]>> {
    return { success: true, data: [...this.fonts], timestamp: new Date().toISOString() };
  }

  async createFont(_token: string, font: { name: string; fontFamily: string; googleFont?: string; previewText?: string }): Promise<ApiResponse<FontItem>> {
    const newFont: FontItem = {
      id: `fnt-${Date.now()}`,
      name: font.name,
      fontFamily: font.fontFamily,
      googleFont: font.googleFont,
      previewText: font.previewText || font.name,
      isCustom: true,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    this.fonts.push(newFont);
    return { success: true, data: newFont, timestamp: new Date().toISOString() };
  }

  async deleteFont(_token: string, id: string): Promise<ApiResponse<{ success: boolean }>> {
    this.fonts = this.fonts.filter(f => f.id !== id);
    return { success: true, data: { success: true }, timestamp: new Date().toISOString() };
  }

  async getAdminStickers(_token: string): Promise<ApiResponse<StickerItem[]>> {
    return { success: true, data: [...this.stickers], timestamp: new Date().toISOString() };
  }

  async createSticker(_token: string, sticker: { name: string; category?: string; type: 'emoji' | 'image'; url: string }): Promise<ApiResponse<StickerItem>> {
    const newSticker: StickerItem = {
      id: `stk-${Date.now()}`,
      name: sticker.name,
      category: sticker.category || (sticker.type === 'image' ? 'PNG Kustom' : 'Emoji'),
      type: sticker.type,
      url: sticker.url,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    this.stickers.push(newSticker);
    return { success: true, data: newSticker, timestamp: new Date().toISOString() };
  }

  async deleteSticker(_token: string, id: string): Promise<ApiResponse<{ success: boolean }>> {
    this.stickers = this.stickers.filter(s => s.id !== id);
    return { success: true, data: { success: true }, timestamp: new Date().toISOString() };
  }
}

export const mockPhotoboothApi = new MockPhotoboothApi();
