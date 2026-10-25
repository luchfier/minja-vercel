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

export interface IPhotoboothApi {
  // Public & Customer Endpoints
  getPublicSettings(): Promise<ApiResponse<PublicBrandingConfig>>;
  getPackages(): Promise<ApiResponse<PackageItem[]>>;
  calculatePrice(req: CalculatePriceRequest): Promise<ApiResponse<CalculatePriceResponse>>;
  validateVoucher(req: ValidateVoucherRequest): Promise<ApiResponse<ValidateVoucherResponse>>;
  createSession(packageId: string): Promise<ApiResponse<CustomerSession>>;
  createPayment(
    sessionId: string,
    paymentMethod?: PaymentMethod,
    voucherCode?: string
  ): Promise<ApiResponse<CreatePaymentResponse>>;
  createExtraPrintsPayment(
    sessionId: string,
    additionalPrints: number,
    paymentMethod?: PaymentMethod
  ): Promise<ApiResponse<CreatePaymentResponse>>;
  checkPaymentStatus(orderId: string): Promise<ApiResponse<PaymentStatusCheckResponse>>;
  cancelSession(sessionId: string): Promise<ApiResponse<{ cancelled: boolean }>>;
  forcePaymentSettlement(orderId: string): Promise<ApiResponse<PaymentStatusCheckResponse>>;
  completeSession(
    sessionId: string,
    selectedPhotoIds: string[],
    templateId?: string
  ): Promise<ApiResponse<{ success: boolean; sessionCode: string }>>;
  
  // Templates
  getTemplates(): Promise<ApiResponse<TemplateItem[]>>;
  
  // Creative Assets (Fonts & Stickers)
  getPublicFonts(): Promise<ApiResponse<FontItem[]>>;
  getPublicStickers(): Promise<ApiResponse<StickerItem[]>>;
  
  // Delivery
  sendEmail(sessionId: string, email: string): Promise<ApiResponse<{ sent: boolean; messageId: string }>>;
  getGalleryUrl(sessionId: string): Promise<ApiResponse<{ qrString: string; galleryUrl: string; expiresAt: string }>>;
  uploadGalleryFile?(
    sessionId: string,
    fileType: 'print_strip' | 'single_photo' | 'animated_gif' | 'live_video',
    dataUrl: string,
    fileName?: string
  ): Promise<ApiResponse<{ id: string; fileType: string; storageUrl: string }>>;
  
  // Admin Endpoints
  loginAdmin(pin: string): Promise<ApiResponse<{ token: string; expiresIn: number }>>;
  changePin(token: string, currentPin: string, newPin: string): Promise<ApiResponse<{ message: string }>>;
  getAdminSettings(token: string): Promise<ApiResponse<AdminThemeConfig>>;
  updateAdminSettings(token: string, settings: Partial<AdminThemeConfig>): Promise<ApiResponse<AdminThemeConfig>>;
  getAdminPackages(token: string): Promise<ApiResponse<PackageItem[]>>;
  createPackage(token: string, pkg: Omit<PackageItem, 'id'>): Promise<ApiResponse<PackageItem>>;
  updatePackage(token: string, id: string, pkg: Partial<PackageItem>): Promise<ApiResponse<PackageItem>>;
  deletePackage(token: string, id: string): Promise<ApiResponse<{ message: string }>>;
  getAdminTemplates(token: string): Promise<ApiResponse<TemplateItem[]>>;
  createTemplate(token: string, tpl: Omit<TemplateItem, 'id'>): Promise<ApiResponse<TemplateItem>>;
  updateTemplate(token: string, id: string, tpl: Partial<TemplateItem>): Promise<ApiResponse<TemplateItem>>;
  deleteTemplate(token: string, id: string): Promise<ApiResponse<{ message: string }>>;
  
  // Admin Creative Assets (Fonts & Stickers)
  getAdminFonts(token: string): Promise<ApiResponse<FontItem[]>>;
  createFont(token: string, font: { name: string; fontFamily: string; googleFont?: string; previewText?: string }): Promise<ApiResponse<FontItem>>;
  deleteFont(token: string, id: string): Promise<ApiResponse<{ success: boolean }>>;
  getAdminStickers(token: string): Promise<ApiResponse<StickerItem[]>>;
  createSticker(token: string, sticker: { name: string; category?: string; type: 'emoji' | 'image'; url: string }): Promise<ApiResponse<StickerItem>>;
  deleteSticker(token: string, id: string): Promise<ApiResponse<{ success: boolean }>>;
  
  // Admin Voucher Endpoints
  getAdminVouchers(token: string): Promise<ApiResponse<VoucherItem[]>>;
  createVoucher(token: string, voucher: Omit<VoucherItem, 'id' | 'usedCount' | 'createdAt'>): Promise<ApiResponse<VoucherItem>>;
  updateVoucher(token: string, id: string, voucher: Partial<VoucherItem>): Promise<ApiResponse<VoucherItem>>;
  deleteVoucher(token: string, id: string): Promise<ApiResponse<{ message: string }>>;

  // Admin Cash Desk & Confirmation Endpoints
  getCashPendingTransactions(token: string): Promise<ApiResponse<CashPendingTransaction[]>>;
  confirmCashPayment(token: string, req: CashConfirmationRequest): Promise<ApiResponse<CashConfirmationResponse>>;
  getCashAuditLogs(token: string): Promise<ApiResponse<CashAuditLogItem[]>>;

  // Reports
  getReportsSummary(token: string): Promise<ApiResponse<ReportSummary>>;
  getTransactions(token: string, params?: PaginationParams): Promise<ApiResponse<PaginatedResponse<TransactionReportItem>>>;
  exportTransactionsCsv(token: string, params?: { startDate?: string; endDate?: string }): Promise<string>;
}

