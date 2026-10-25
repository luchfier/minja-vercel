import { IPhotoboothApi } from './api.interface';
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
import { VoucherItem, VoucherType, ValidateVoucherRequest, ValidateVoucherResponse } from '../types/voucher';
import { FontItem, StickerItem } from '../types/assets';
import { mockPhotoboothApi } from '../mocks/mockPhotoboothApi';

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:3000/api';
const BOOTH_KEY = (import.meta as any).env?.VITE_BOOTH_KEY || 'dev-booth-key-for-testing';

class HttpPhotoboothApi implements IPhotoboothApi {
  private fallback = mockPhotoboothApi;

  // 1. Public Settings
  async getPublicSettings(): Promise<ApiResponse<PublicBrandingConfig>> {
    try {
      const res = await fetch(`${API_BASE}/settings`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          const config: PublicBrandingConfig = {
            boothName: d.boothName || 'MinjaPhotobooth',
            tagline: d.brandTitle || 'Momen Istimewa, Abadi Bersama',
            logoUrl: d.logoUrl || '',
            wallpaperUrl: d.wallpaperUrl || '',
            welcomeHeadline: d.welcomeText || 'Sentuh Layar Untuk Mengabadikan Momenmu',
            welcomeSubheadline: 'Photobooth Mandiri Kualitas Studio Cetak Instan',
            startSessionButtonText: 'Mulai Sesi Foto',
            primaryColor: d.primaryColor || '#F59E0B',
            accentColor: d.secondaryColor || '#38BDF8',
            darkSurfaceColor: '#0E131F',
            backgroundBlur: 8,
            backgroundOverlayOpacity: 50,
            backgroundFit: 'cover',
            backgroundOpacity: 100,
            logoHeight: 64,
            glassmorphismIntensity: 'medium',
            enableVignette: true,
          };
          return { success: true, data: config, timestamp: json.timestamp || new Date().toISOString() };
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal memuat public settings dari backend, menggunakan fallback offline:', e);
    }
    return this.fallback.getPublicSettings();
  }

  // 2. Packages
  async getPackages(): Promise<ApiResponse<PackageItem[]>> {
    try {
      const res = await fetch(`${API_BASE}/packages`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const mapped: PackageItem[] = json.data.map((p: any, idx: number) => ({
            id: p.id,
            name: p.name,
            description: p.description || '',
            price: p.price,
            durationSeconds: p.durationSeconds || 180,
            printCopies: p.defaultPrints ?? p.printCopies ?? 1,
            additionalPrintPrice: p.additionalPrintPrice ?? 15000,
            isActive: p.isActive ?? true,
            sortOrder: p.sortOrder ?? idx + 1,
            badge: idx === 1 ? 'Paling Populer' : idx === 2 ? 'Grup & Keluarga' : 'Hemat',
          }));
          return { success: true, data: mapped, timestamp: json.timestamp || new Date().toISOString() };
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal memuat paket dari backend, menggunakan fallback offline:', e);
    }
    return this.fallback.getPackages();
  }

  async calculatePrice(req: CalculatePriceRequest): Promise<ApiResponse<CalculatePriceResponse>> {
    try {
      const res = await fetch(`${API_BASE}/packages/calculate-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return {
            success: true,
            data: json.data,
            timestamp: json.timestamp || new Date().toISOString(),
          };
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal calculatePrice via backend, fallback:', e);
    }
    return this.fallback.calculatePrice(req);
  }

  async validateVoucher(req: ValidateVoucherRequest): Promise<ApiResponse<ValidateVoucherResponse>> {
    try {
      const res = await fetch(`${API_BASE}/vouchers/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: req.code,
          packageId: req.packageId,
          subtotal: req.subtotal,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          const mapped: ValidateVoucherResponse = {
            isValid: d.isValid ?? d.valid ?? false,
            voucher: d.voucher
              ? {
                code: d.voucher.code,
                name: d.voucher.name || d.voucher.code,
                type: d.voucher.type as VoucherType,
                discountValue: d.voucher.discountValue,
                discountAmount: d.voucher.discountAmount ?? d.discountAmount ?? 0,
              }
              : undefined,
            errorMessage: d.errorMessage || d.message,
            errorCode: d.errorCode,
          };
          return {
            success: true,
            data: mapped,
            timestamp: json.timestamp || new Date().toISOString(),
          };
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal validateVoucher via backend, mencoba fallback:', e);
    }
    return this.fallback.validateVoucher(req);
  }

  async createSession(packageId: string): Promise<ApiResponse<CustomerSession>> {
    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Booth-Key': BOOTH_KEY,
        },
        body: JSON.stringify({ packageId, additionalPrints: 0 }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const s = json.data;
          const session: CustomerSession = {
            sessionId: s.id,
            sessionCode: 'MJ-' + s.id.slice(-4).toUpperCase(),
            state: s.state,
            package: {
              id: s.packageId,
              name: s.packageName,
              description: '',
              price: s.basePrice,
              durationSeconds: s.durationSeconds,
              printCopies: s.totalPrints,
              additionalPrintPrice: s.additionalPrintCost,
              isActive: true,
              sortOrder: 1,
            },
            photos: [],
            selectedPhotoIds: [],
            additionalPrints: s.additionalPrints,
            createdAt: s.createdAt,
            expiresAt: s.expiresAt,
          };
          return {
            success: true,
            data: session,
            timestamp: json.timestamp || new Date().toISOString(),
          };
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal createSession via backend, menggunakan fallback offline:', e);
    }
    return this.fallback.createSession(packageId);
  }

  async createPayment(
    sessionId: string,
    paymentMethod: PaymentMethod = 'qris',
    voucherCode?: string
  ): Promise<ApiResponse<CreatePaymentResponse>> {
    try {
      const res = await fetch(`${API_BASE}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Booth-Key': BOOTH_KEY,
        },
        body: JSON.stringify({ sessionId, paymentMethod, voucherCode }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const p = json.data;
          const mapped: CreatePaymentResponse = {
            paymentId: p.id,
            orderId: p.orderId,
            paymentMethod: p.paymentMethod,
            qrString: p.qrString || undefined,
            qrUrl: p.qrImageUrl || undefined,
            simulatorUrl: p.simulatorUrl || undefined,
            basePrice: p.subtotal,
            additionalPrintsTotal: 0,
            voucherCode: p.voucherCode || undefined,
            discountAmount: p.voucherDiscount || 0,
            grossAmount: p.grossAmount,
            expiryTime: p.expiryTime,
            status: p.transactionStatus,
          };

          // Sinkronkan ke report storage agar tampil di dashboard admin & laporan transaksi
          try {
            const raw = localStorage.getItem('minja_kiosk_transactions');
            const list = raw ? JSON.parse(raw) : [];
            const existingIdx = list.findIndex((t: any) => t.orderId === p.orderId);
            const txItem = {
              id: 'tx-' + p.id,
              orderId: p.orderId,
              sessionCode: 'MJ-' + (sessionId.slice(-4) || '8888').toUpperCase(),
              packageName: 'Paket Photobooth',
              paymentMethod,
              subtotal: p.subtotal,
              voucherCode,
              discountAmount: p.voucherDiscount || 0,
              grossAmount: p.grossAmount,
              additionalPrints: 0,
              status: p.transactionStatus,
              paymentType: paymentMethod === 'cash' ? 'Tunai / Cash' : 'QRIS Midtrans',
              createdAt: p.createdAt || new Date().toISOString(),
            };
            if (existingIdx !== -1) list[existingIdx] = txItem;
            else list.unshift(txItem);
            localStorage.setItem('minja_kiosk_transactions', JSON.stringify(list));
          } catch { }

          return {
            success: true,
            data: mapped,
            timestamp: json.timestamp || new Date().toISOString(),
          };
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal createPayment via backend, menggunakan fallback offline:', e);
    }
    return this.fallback.createPayment(sessionId, paymentMethod, voucherCode);
  }

  async createExtraPrintsPayment(
    sessionId: string,
    additionalPrints: number,
    paymentMethod: PaymentMethod = 'qris'
  ): Promise<ApiResponse<CreatePaymentResponse>> {
    try {
      const res = await fetch(`${API_BASE}/payments/extra-prints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Booth-Key': BOOTH_KEY,
        },
        body: JSON.stringify({ sessionId, additionalPrints, paymentMethod }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const p = json.data;
          const mapped: CreatePaymentResponse = {
            paymentId: p.id,
            orderId: p.orderId,
            paymentMethod: p.paymentMethod,
            qrString: p.qrString || undefined,
            qrUrl: p.qrImageUrl || undefined,
            simulatorUrl: p.simulatorUrl || undefined,
            basePrice: 0,
            additionalPrintsTotal: p.grossAmount,
            voucherCode: undefined,
            discountAmount: 0,
            grossAmount: p.grossAmount,
            expiryTime: p.expiryTime,
            status: p.transactionStatus,
          };

          // Sinkronkan ke report storage agar tampil di dashboard admin & laporan transaksi
          try {
            const raw = localStorage.getItem('minja_kiosk_transactions');
            const list = raw ? JSON.parse(raw) : [];
            const existingIdx = list.findIndex((t: any) => t.orderId === p.orderId);
            const txItem = {
              id: 'tx-' + p.id,
              orderId: p.orderId,
              sessionCode: 'MJ-' + (sessionId.slice(-4) || '8888').toUpperCase(),
              packageName: `Extra Prints (+${additionalPrints})`,
              paymentMethod,
              subtotal: p.grossAmount,
              voucherCode: undefined,
              discountAmount: 0,
              grossAmount: p.grossAmount,
              additionalPrints,
              status: p.transactionStatus,
              paymentType: paymentMethod === 'cash' ? 'Tunai / Cash' : 'QRIS Midtrans',
              createdAt: p.createdAt || new Date().toISOString(),
            };
            if (existingIdx !== -1) list[existingIdx] = txItem;
            else list.unshift(txItem);
            localStorage.setItem('minja_kiosk_transactions', JSON.stringify(list));
          } catch { }

          return {
            success: true,
            data: mapped,
            timestamp: json.timestamp || new Date().toISOString(),
          };
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal createExtraPrintsPayment via backend, fallback offline:', e);
    }
    return this.fallback.createExtraPrintsPayment(sessionId, additionalPrints, paymentMethod);
  }

  async checkPaymentStatus(orderId: string): Promise<ApiResponse<PaymentStatusCheckResponse>> {
    try {
      const res = await fetch(`${API_BASE}/payments/${encodeURIComponent(orderId)}/status`, {
        headers: {
          'X-Booth-Key': BOOTH_KEY,
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          const mapped: PaymentStatusCheckResponse = {
            orderId: d.orderId,
            paymentMethod: d.paymentMethod,
            transactionStatus: d.transactionStatus,
            isVerified: d.isVerified,
            grossAmount: d.grossAmount,
            paymentType: d.paymentMethod === 'cash' ? 'Tunai / Cash' : 'QRIS Midtrans',
            settlementTime: d.settlementTime || undefined,
          };

          if (d.transactionStatus === 'settlement' || d.transactionStatus === 'expire' || d.transactionStatus === 'cancel') {
            try {
              const raw = localStorage.getItem('minja_kiosk_transactions');
              if (raw) {
                const list = JSON.parse(raw);
                const item = list.find((t: any) => t.orderId === d.orderId);
                if (item) {
                  item.status = d.transactionStatus;
                  item.settlementTime = d.settlementTime || new Date().toISOString();
                  localStorage.setItem('minja_kiosk_transactions', JSON.stringify(list));
                }
              }
            } catch { }
          }

          return {
            success: true,
            data: mapped,
            timestamp: json.timestamp || new Date().toISOString(),
          };
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal checkPaymentStatus via backend, menggunakan fallback offline:', e);
    }
    return this.fallback.checkPaymentStatus(orderId);
  }

  async cancelSession(sessionId: string): Promise<ApiResponse<{ cancelled: boolean }>> {
    try {
      const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Booth-Key': BOOTH_KEY,
        },
        body: JSON.stringify({ reason: 'Dibatalkan oleh pelanggan' }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          return {
            success: true,
            data: { cancelled: true },
            timestamp: json.timestamp || new Date().toISOString(),
          };
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal cancelSession via backend, menggunakan fallback offline:', e);
    }
    return this.fallback.cancelSession(sessionId);
  }

  async forcePaymentSettlement(orderId: string): Promise<ApiResponse<PaymentStatusCheckResponse>> {
    try {
      const res = await fetch(`${API_BASE}/payments/${encodeURIComponent(orderId)}/force-settle`, {
        method: 'POST',
        headers: {
          'X-Booth-Key': BOOTH_KEY,
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          const mapped: PaymentStatusCheckResponse = {
            orderId: d.orderId,
            paymentMethod: d.paymentMethod,
            transactionStatus: d.transactionStatus,
            isVerified: d.isVerified,
            grossAmount: d.grossAmount,
            paymentType: d.paymentMethod === 'cash' ? 'Tunai / Cash' : 'QRIS Midtrans',
            settlementTime: d.settlementTime || undefined,
          };

          try {
            const raw = localStorage.getItem('minja_kiosk_transactions');
            if (raw) {
              const list = JSON.parse(raw);
              const item = list.find((t: any) => t.orderId === d.orderId);
              if (item) {
                item.status = 'settlement';
                item.settlementTime = d.settlementTime || new Date().toISOString();
                localStorage.setItem('minja_kiosk_transactions', JSON.stringify(list));
              }
            }
          } catch { }

          return {
            success: true,
            data: mapped,
            timestamp: json.timestamp || new Date().toISOString(),
          };
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal forcePaymentSettlement via backend, fallback offline:', e);
    }
    return this.fallback.forcePaymentSettlement(orderId);
  }

  async completeSession(
    sessionId: string,
    selectedPhotoIds: string[],
    templateId?: string
  ): Promise<ApiResponse<{ success: boolean; sessionCode: string }>> {
    try {
      const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Booth-Key': BOOTH_KEY,
        },
        body: JSON.stringify({
          shotsTaken: selectedPhotoIds.length,
          photosSelected: selectedPhotoIds.length,
          photosPrinted: 1,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          return {
            success: true,
            data: {
              success: true,
              sessionCode: 'MJ-' + (sessionId.slice(-4) || '8888').toUpperCase(),
            },
            timestamp: json.timestamp || new Date().toISOString(),
          };
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal completeSession via backend, mencoba fallback:', e);
    }
    return this.fallback.completeSession(sessionId, selectedPhotoIds, templateId);
  }

  // 3. Templates
  async getTemplates(): Promise<ApiResponse<TemplateItem[]>> {
    try {
      const res = await fetch(`${API_BASE}/templates`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const fbRes = await this.fallback.getTemplates();
          const fallbackTpls = fbRes.success ? fbRes.data : [];
          const mapped: TemplateItem[] = json.data.map((t: any, idx: number) => {
            const fb = fallbackTpls[idx] || fallbackTpls[0];
            return {
              id: t.id,
              name: t.name,
              thumbnailUrl: t.thumbnailUrl || fb?.thumbnailUrl || '',
              frameUrl:
                t.frameOverlayUrl && !t.frameOverlayUrl.startsWith('/templates/')
                  ? t.frameOverlayUrl
                  : fb?.frameUrl || '',
              layoutType: t.layoutType || (t.orientation === 'landscape' ? '4R_LANDSCAPE' : '4R_PORTRAIT'),
              width: t.width || (t.orientation === 'landscape' ? 1800 : 1200),
              height: t.height || (t.orientation === 'landscape' ? 1200 : 1800),
              isActive: t.isActive ?? true,
              isDefault: idx === 0,
              slots: Array.isArray(t.slots)
                ? t.slots.map((s: any, sIdx: number) => ({
                  id: s.id || `s-${sIdx}`,
                  x: s.x,
                  y: s.y,
                  width: s.width,
                  height: s.height,
                  rotation: s.rotation || 0,
                  layerIndex: s.layerIndex || 1,
                }))
                : fb?.slots || [],
            };
          });
          return { success: true, data: mapped, timestamp: json.timestamp || new Date().toISOString() };
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal memuat template dari backend, menggunakan fallback offline:', e);
    }
    return this.fallback.getTemplates();
  }

  async sendEmail(sessionId: string, email: string): Promise<ApiResponse<{ sent: boolean; messageId: string }>> {
    try {
      const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Booth-Key': BOOTH_KEY,
        },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return {
            success: true,
            data: {
              sent: json.data.sent ?? true,
              messageId: json.data.messageId || 'email-sent',
            },
            timestamp: json.timestamp || new Date().toISOString(),
          };
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal mengirim email soft file via backend, fallback offline:', e);
    }
    return this.fallback.sendEmail(sessionId, email);
  }

  async getGalleryUrl(sessionId: string): Promise<ApiResponse<{ qrString: string; galleryUrl: string; expiresAt: string }>> {
    try {
      const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/gallery`, {
        headers: {
          'X-Booth-Key': BOOTH_KEY,
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return {
            success: true,
            data: {
              qrString: json.data.qrString || json.data.galleryUrl,
              galleryUrl: json.data.galleryUrl,
              expiresAt: json.data.expiresAt,
            },
            timestamp: json.timestamp || new Date().toISOString(),
          };
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal memuat gallery URL dari backend, fallback offline:', e);
    }
    return this.fallback.getGalleryUrl(sessionId);
  }

  async uploadGalleryFile(
    sessionId: string,
    fileType: 'print_strip' | 'single_photo' | 'animated_gif' | 'live_video',
    dataUrl: string,
    fileName?: string
  ): Promise<ApiResponse<{ id: string; fileType: string; storageUrl: string }>> {
    try {
      const mappedFileType =
        fileType === 'print_strip'
          ? 'layout_4r'
          : fileType === 'single_photo'
            ? 'raw_photo'
            : fileType === 'live_video'
              ? 'live_video'
              : 'layout_4r';

      const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/gallery/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Booth-Key': BOOTH_KEY,
        },
        body: JSON.stringify({ fileType: mappedFileType, dataUrl, fileName }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return {
            success: true,
            data: json.data,
            timestamp: json.timestamp || new Date().toISOString(),
          };
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal upload file galeri via backend, fallback lokal:', e);
    }
    return {
      success: true,
      data: { id: `local-${Date.now()}`, fileType, storageUrl: dataUrl },
      timestamp: new Date().toISOString(),
    };
  }

  // 4. Admin Auth
  async loginAdmin(pin: string): Promise<ApiResponse<{ token: string; expiresIn: number }>> {
    try {
      const res = await fetch(`${API_BASE}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const json = await res.json();
      if (json.success && json.data?.token) {
        return {
          success: true,
          data: {
            token: json.data.token,
            expiresIn: 3600,
          },
          timestamp: json.timestamp || new Date().toISOString(),
        };
      }
      if (json.error) {
        return {
          success: false,
          error: { code: json.error.code, message: json.error.message },
          timestamp: json.timestamp || new Date().toISOString(),
        };
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal login via backend, mencoba fallback PIN lokal:', e);
    }
    return this.fallback.loginAdmin(pin);
  }

  async changePin(token: string, currentPin: string, newPin: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const res = await fetch(`${API_BASE}/admin/pin`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPin, newPin }),
      });
      const json = await res.json();
      if (json.success) {
        return { success: true, data: { message: json.data?.message || 'PIN berhasil diubah' }, timestamp: json.timestamp };
      }
    } catch { }
    return this.fallback.changePin(token, currentPin, newPin);
  }

  // 5. Admin Settings
  async getAdminSettings(token: string): Promise<ApiResponse<AdminThemeConfig>> {
    try {
      const res = await fetch(`${API_BASE}/admin/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          const mapped: AdminThemeConfig = {
            boothName: d.boothName || 'MinjaPhotobooth',
            tagline: d.brandTitle || 'Momen Istimewa, Abadi Bersama',
            logoUrl: d.logoUrl || '',
            wallpaperUrl: d.wallpaperUrl || '',
            welcomeHeadline: d.welcomeText || 'Sentuh Layar Untuk Mengabadikan Momenmu',
            welcomeSubheadline: 'Photobooth Mandiri Kualitas Studio Cetak Instan',
            startSessionButtonText: 'Mulai Sesi Foto',
            primaryColor: d.primaryColor || '#F59E0B',
            accentColor: d.secondaryColor || '#38BDF8',
            darkSurfaceColor: '#0E131F',
            sessionTimeoutSeconds: d.maxSessionTimeoutSeconds || 600,
            paymentTimeoutSeconds: d.paymentTimeoutSeconds || 300,
            photoRetentionHours: d.retentionHours || 48,
            extraPrintPrice: 15000,
            backgroundBlur: 8,
            backgroundOverlayOpacity: 50,
            backgroundFit: 'cover',
            backgroundOpacity: 100,
            logoHeight: 64,
            glassmorphismIntensity: 'medium',
            enableVignette: true,
          };
          return { success: true, data: mapped, timestamp: json.timestamp };
        }
      }
    } catch { }
    return this.fallback.getAdminSettings(token);
  }

  async updateAdminSettings(token: string, settings: Partial<AdminThemeConfig>): Promise<ApiResponse<AdminThemeConfig>> {
    try {
      const payload: any = {};
      if (settings.boothName) payload.boothName = settings.boothName;
      if (settings.tagline) payload.brandTitle = settings.tagline;
      if (settings.welcomeHeadline) payload.welcomeText = settings.welcomeHeadline;
      if (settings.primaryColor) payload.primaryColor = settings.primaryColor;
      if (settings.accentColor) payload.secondaryColor = settings.accentColor;
      if (settings.photoRetentionHours) payload.retentionHours = settings.photoRetentionHours;
      if (settings.sessionTimeoutSeconds) payload.maxSessionTimeoutSeconds = settings.sessionTimeoutSeconds;
      if (settings.paymentTimeoutSeconds) payload.paymentTimeoutSeconds = settings.paymentTimeoutSeconds;

      const res = await fetch(`${API_BASE}/admin/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          return this.getAdminSettings(token);
        }
      }
    } catch { }
    return this.fallback.updateAdminSettings(token, settings);
  }

  // 6. Admin Packages
  async getAdminPackages(token: string): Promise<ApiResponse<PackageItem[]>> {
    try {
      const res = await fetch(`${API_BASE}/admin/packages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.items) {
          const mapped: PackageItem[] = json.data.items.map((p: any) => ({
            id: p.id,
            name: p.name,
            description: p.description || '',
            price: p.price,
            durationSeconds: p.durationSeconds || 180,
            printCopies: p.defaultPrints ?? p.printCopies ?? 1,
            additionalPrintPrice: p.additionalPrintPrice ?? 15000,
            isActive: p.isActive ?? true,
            sortOrder: p.sortOrder ?? 0,
            badge: p.badge,
          }));
          return { success: true, data: mapped, timestamp: json.timestamp };
        }
      }
    } catch { }
    return this.fallback.getAdminPackages(token);
  }

  async createPackage(token: string, pkg: Omit<PackageItem, 'id'>): Promise<ApiResponse<PackageItem>> {
    try {
      const payload = {
        name: pkg.name,
        description: pkg.description || '',
        price: pkg.price,
        durationSeconds: pkg.durationSeconds,
        maxShots: Math.max(pkg.printCopies * 2, 6),
        maxSelections: Math.max(pkg.printCopies, 3),
        defaultPrints: pkg.printCopies,
        additionalPrintPrice: pkg.additionalPrintPrice || 15000,
        sortOrder: pkg.sortOrder || 0,
        isActive: pkg.isActive ?? true,
      };
      const res = await fetch(`${API_BASE}/admin/packages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const p = json.data;
          return {
            success: true,
            data: {
              id: p.id,
              name: p.name,
              description: p.description,
              price: p.price,
              durationSeconds: p.durationSeconds,
              printCopies: p.defaultPrints,
              additionalPrintPrice: p.additionalPrintPrice,
              isActive: p.isActive,
              sortOrder: p.sortOrder,
            },
            timestamp: json.timestamp,
          };
        }
      }
    } catch { }
    return this.fallback.createPackage(token, pkg);
  }

  async updatePackage(token: string, id: string, pkg: Partial<PackageItem>): Promise<ApiResponse<PackageItem>> {
    try {
      const payload: any = {};
      if (pkg.name !== undefined) payload.name = pkg.name;
      if (pkg.description !== undefined) payload.description = pkg.description;
      if (pkg.price !== undefined) payload.price = pkg.price;
      if (pkg.durationSeconds !== undefined) payload.durationSeconds = pkg.durationSeconds;
      if (pkg.printCopies !== undefined) {
        payload.defaultPrints = pkg.printCopies;
        payload.maxSelections = Math.max(pkg.printCopies, 3);
        payload.maxShots = Math.max(pkg.printCopies * 2, 6);
      }
      if (pkg.additionalPrintPrice !== undefined) payload.additionalPrintPrice = pkg.additionalPrintPrice;
      if (pkg.isActive !== undefined) payload.isActive = pkg.isActive;
      if (pkg.sortOrder !== undefined) payload.sortOrder = pkg.sortOrder;

      const res = await fetch(`${API_BASE}/admin/packages/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const p = json.data;
          return {
            success: true,
            data: {
              id: p.id,
              name: p.name,
              description: p.description,
              price: p.price,
              durationSeconds: p.durationSeconds,
              printCopies: p.defaultPrints,
              additionalPrintPrice: p.additionalPrintPrice,
              isActive: p.isActive,
              sortOrder: p.sortOrder,
            },
            timestamp: json.timestamp,
          };
        }
      }
    } catch { }
    return this.fallback.updatePackage(token, id, pkg);
  }

  async deletePackage(token: string, id: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const res = await fetch(`${API_BASE}/admin/packages/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) return json;
      }
    } catch { }
    return this.fallback.deletePackage(token, id);
  }

  // 7. Admin Templates
  async getAdminTemplates(token: string): Promise<ApiResponse<TemplateItem[]>> {
    try {
      const res = await fetch(`${API_BASE}/admin/templates?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.items) {
          const mapped: TemplateItem[] = json.data.items.map((t: any, idx: number) => ({
            id: t.id,
            name: t.name,
            thumbnailUrl: t.thumbnailUrl || '',
            frameUrl: t.frameOverlayUrl || '',
            layoutType: t.layoutType || (t.orientation === 'landscape' ? '4R_LANDSCAPE' : '4R_PORTRAIT'),
            width: t.width || (t.orientation === 'landscape' ? 1800 : 1200),
            height: t.height || (t.orientation === 'landscape' ? 1200 : 1800),
            isActive: t.isActive ?? true,
            isDefault: idx === 0,
            slots: (() => {
              let sList = t.slots;
              if (typeof sList === 'string') {
                try { sList = JSON.parse(sList); } catch {}
              }
              return Array.isArray(sList)
                ? sList.map((s: any, sIdx: number) => ({
                  id: s.id || `s-${sIdx}`,
                  x: Number(s.x) || 0,
                  y: Number(s.y) || 0,
                  width: Number(s.width) || 100,
                  height: Number(s.height) || 100,
                  rotation: Number(s.rotation) || 0,
                  layerIndex: Number(s.layerIndex) || 1,
                }))
                : [];
            })(),
          }));
          return { success: true, data: mapped, timestamp: json.timestamp || new Date().toISOString() };
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal memuat admin templates dari backend:', e);
    }
    return this.fallback.getAdminTemplates(token);
  }

  async createTemplate(token: string, tpl: Omit<TemplateItem, 'id'>): Promise<ApiResponse<TemplateItem>> {
    try {
      const res = await fetch(`${API_BASE}/admin/templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: tpl.name,
          thumbnailUrl: tpl.thumbnailUrl || '',
          frameOverlayUrl: tpl.frameUrl || '',
          orientation: tpl.layoutType === '4R_LANDSCAPE' ? 'landscape' : 'portrait',
          slotsCount: tpl.slots.length,
          slots: tpl.slots,
          isActive: tpl.isActive ?? true,
          isDefault: tpl.isDefault ?? false,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const t = json.data;
          const mapped: TemplateItem = {
            id: t.id,
            name: t.name,
            thumbnailUrl: t.thumbnailUrl,
            frameUrl: t.frameOverlayUrl,
            layoutType: t.layoutType || (t.orientation === 'landscape' ? '4R_LANDSCAPE' : '4R_PORTRAIT'),
            width: t.width || tpl.width || (t.orientation === 'landscape' ? 1800 : 1200),
            height: t.height || tpl.height || (t.orientation === 'landscape' ? 1200 : 1800),
            isActive: t.isActive,
            isDefault: tpl.isDefault ?? false,
            slots: Array.isArray(t.slots) ? t.slots : [],
          };
          // Also sync fallback cache so offline kiosk stays up to date
          try {
            await this.fallback.createTemplate(token, mapped);
          } catch {}
          return {
            success: true,
            data: mapped,
            timestamp: json.timestamp || new Date().toISOString(),
          };
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        console.error('[HttpApi] Server rejected createTemplate:', res.status, errJson);
        const errMsg = errJson?.error?.message || `Gagal menyimpan template ke server (Status ${res.status})`;
        return {
          success: false,
          error: {
            code: errJson?.error?.code || 'CREATE_TEMPLATE_FAILED',
            message: errMsg,
          },
          timestamp: new Date().toISOString(),
        };
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal createTemplate via backend (jaringan offline), beralih ke fallback:', e);
    }
    return this.fallback.createTemplate(token, tpl);
  }

  async updateTemplate(token: string, id: string, tpl: Partial<TemplateItem>): Promise<ApiResponse<TemplateItem>> {
    try {
      const payload: any = {};
      if (tpl.name !== undefined) payload.name = tpl.name;
      if (tpl.thumbnailUrl !== undefined) payload.thumbnailUrl = tpl.thumbnailUrl;
      if (tpl.frameUrl !== undefined) payload.frameOverlayUrl = tpl.frameUrl;
      if (tpl.layoutType !== undefined) payload.orientation = tpl.layoutType === '4R_LANDSCAPE' ? 'landscape' : 'portrait';
      if (tpl.slots !== undefined) {
        payload.slots = tpl.slots;
        payload.slotsCount = tpl.slots.length;
      }
      if (tpl.isActive !== undefined) payload.isActive = tpl.isActive;
      if (tpl.isDefault !== undefined) payload.isDefault = tpl.isDefault;

      const res = await fetch(`${API_BASE}/admin/templates/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const t = json.data;
          const mapped: TemplateItem = {
            id: t.id,
            name: t.name,
            thumbnailUrl: t.thumbnailUrl || '',
            frameUrl: t.frameOverlayUrl || tpl.frameUrl || '',
            layoutType: t.layoutType || (t.orientation === 'landscape' ? '4R_LANDSCAPE' : '4R_PORTRAIT'),
            width: t.width || tpl.width || (t.orientation === 'landscape' ? 1800 : 1200),
            height: t.height || tpl.height || (t.orientation === 'landscape' ? 1200 : 1800),
            isActive: t.isActive ?? true,
            slots: (() => {
              let sList = t.slots;
              if (typeof sList === 'string') {
                try { sList = JSON.parse(sList); } catch {}
              }
              if (Array.isArray(sList) && sList.length > 0) return sList;
              return tpl.slots || [];
            })(),
          };
          try {
            await this.fallback.updateTemplate(token, id, mapped);
          } catch {}
          return {
            success: true,
            data: mapped,
            timestamp: json.timestamp || new Date().toISOString(),
          };
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        console.error('[HttpApi] Server rejected updateTemplate:', res.status, errJson);
        const errMsg = errJson?.error?.message || `Gagal memperbarui template di server (Status ${res.status})`;
        return {
          success: false,
          error: {
            code: errJson?.error?.code || 'UPDATE_TEMPLATE_FAILED',
            message: errMsg,
          },
          timestamp: new Date().toISOString(),
        };
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal updateTemplate via backend (jaringan offline), beralih ke fallback:', e);
    }
    return this.fallback.updateTemplate(token, id, tpl);
  }

  async deleteTemplate(token: string, id: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const res = await fetch(`${API_BASE}/admin/templates/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          // Permanently sync with fallback
          await this.fallback.deleteTemplate(token, id);
          return json;
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        console.warn('[HttpApi] Server deleteTemplate response:', res.status, errJson);
        // If 404 on server (e.g. offline mock template), still delete from fallback
        if (res.status === 404) {
          return this.fallback.deleteTemplate(token, id);
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal deleteTemplate via backend:', e);
    }
    return this.fallback.deleteTemplate(token, id);
  }

  // 8. Admin Vouchers
  async getAdminVouchers(token: string): Promise<ApiResponse<VoucherItem[]>> {
    try {
      const res = await fetch(`${API_BASE}/admin/vouchers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const mapped: VoucherItem[] = json.data.map((v: any) => ({
            id: v.id,
            code: v.code,
            name: v.code,
            description:
              v.discountType === 'percentage'
                ? `Diskon ${v.discountValue}%`
                : `Potongan Rp ${v.discountValue.toLocaleString('id-ID')}`,
            type: v.discountType === 'percentage' ? 'percentage' : 'fixed',
            discountValue: v.discountValue,
            maxDiscount: v.maxDiscount || undefined,
            minTransaction: v.minSpend || 0,
            quota: v.usageLimit || 9999,
            usedCount: v.usedCount || 0,
            validFrom: v.validFrom || new Date().toISOString(),
            validUntil: v.validUntil || new Date(Date.now() + 365 * 86400000).toISOString(),
            isActive: v.isActive ?? true,
            createdAt: v.createdAt || new Date().toISOString(),
          }));
          return { success: true, data: mapped, timestamp: json.timestamp || new Date().toISOString() };
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal getAdminVouchers via backend:', e);
    }
    return this.fallback.getAdminVouchers(token);
  }

  async createVoucher(token: string, voucher: Omit<VoucherItem, 'id' | 'usedCount' | 'createdAt'>): Promise<ApiResponse<VoucherItem>> {
    try {
      const payload = {
        code: voucher.code,
        name: voucher.name,
        discountType: voucher.type === 'percentage' ? 'percentage' : 'fixed',
        discountValue: voucher.discountValue,
        minSpend: voucher.minTransaction || 0,
        maxDiscount: voucher.maxDiscount || null,
        validFrom: voucher.validFrom,
        validUntil: voucher.validUntil,
        usageLimit: voucher.quota || 100,
        isActive: voucher.isActive ?? true,
      };
      const res = await fetch(`${API_BASE}/admin/vouchers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const v = json.data;
          return {
            success: true,
            data: {
              id: v.id,
              code: v.code,
              name: v.code,
              description:
                v.discountType === 'percentage'
                  ? `Diskon ${v.discountValue}%`
                  : `Potongan Rp ${v.discountValue.toLocaleString('id-ID')}`,
              type: v.discountType === 'percentage' ? 'percentage' : 'fixed',
              discountValue: v.discountValue,
              maxDiscount: v.maxDiscount || undefined,
              minTransaction: v.minSpend || 0,
              quota: v.usageLimit || 100,
              usedCount: v.usedCount || 0,
              validFrom: v.validFrom,
              validUntil: v.validUntil,
              isActive: v.isActive,
              createdAt: v.createdAt,
            },
            timestamp: json.timestamp || new Date().toISOString(),
          };
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal createVoucher via backend:', e);
    }
    return this.fallback.createVoucher(token, voucher);
  }

  async updateVoucher(token: string, id: string, voucher: Partial<VoucherItem>): Promise<ApiResponse<VoucherItem>> {
    try {
      const payload: any = {};
      if (voucher.code !== undefined) payload.code = voucher.code;
      if (voucher.name !== undefined) payload.name = voucher.name;
      if (voucher.type !== undefined) payload.discountType = voucher.type;
      if (voucher.discountValue !== undefined) payload.discountValue = voucher.discountValue;
      if (voucher.minTransaction !== undefined) payload.minSpend = voucher.minTransaction;
      if (voucher.maxDiscount !== undefined) payload.maxDiscount = voucher.maxDiscount;
      if (voucher.validFrom !== undefined) payload.validFrom = voucher.validFrom;
      if (voucher.validUntil !== undefined) payload.validUntil = voucher.validUntil;
      if (voucher.quota !== undefined) payload.usageLimit = voucher.quota;
      if (voucher.isActive !== undefined) payload.isActive = voucher.isActive;

      const res = await fetch(`${API_BASE}/admin/vouchers/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const v = json.data;
          return {
            success: true,
            data: {
              id: v.id,
              code: v.code,
              name: v.code,
              description:
                v.discountType === 'percentage'
                  ? `Diskon ${v.discountValue}%`
                  : `Potongan Rp ${v.discountValue.toLocaleString('id-ID')}`,
              type: v.discountType === 'percentage' ? 'percentage' : 'fixed',
              discountValue: v.discountValue,
              maxDiscount: v.maxDiscount || undefined,
              minTransaction: v.minSpend || 0,
              quota: v.usageLimit || 100,
              usedCount: v.usedCount || 0,
              validFrom: v.validFrom,
              validUntil: v.validUntil,
              isActive: v.isActive,
              createdAt: v.createdAt,
            },
            timestamp: json.timestamp || new Date().toISOString(),
          };
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal updateVoucher via backend:', e);
    }
    return this.fallback.updateVoucher(token, id, voucher);
  }

  async deleteVoucher(token: string, id: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const res = await fetch(`${API_BASE}/admin/vouchers/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) return json;
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal deleteVoucher via backend:', e);
    }
    return this.fallback.deleteVoucher(token, id);
  }

  // 9. Cash Desk
  async getCashPendingTransactions(token: string): Promise<ApiResponse<CashPendingTransaction[]>> {
    try {
      const res = await fetch(`${API_BASE}/admin/cash/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return {
            success: true,
            data: json.data,
            timestamp: json.timestamp || new Date().toISOString(),
          };
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal getCashPendingTransactions via backend:', e);
    }
    return this.fallback.getCashPendingTransactions(token);
  }

  async confirmCashPayment(token: string, req: CashConfirmationRequest): Promise<ApiResponse<CashConfirmationResponse>> {
    try {
      const res = await fetch(`${API_BASE}/admin/cash/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Booth-Key': BOOTH_KEY,
        },
        body: JSON.stringify({
          orderId: req.orderId,
          pin: req.adminPin,
          receivedAmount: req.receivedAmount,
          operatorId: req.operatorId,
          cashierNote: req.cashierNote,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        return {
          success: true,
          data: {
            orderId: json.data.orderId,
            status: 'settlement',
            grossAmount: json.data.grossAmount,
            receivedAmount: json.data.receivedAmount,
            changeAmount: json.data.changeAmount,
            confirmedBy: json.data.confirmedBy,
            confirmedAt: json.data.confirmedAt,
          },
          timestamp: json.timestamp || new Date().toISOString(),
        };
      }
      if (json.error) {
        return {
          success: false,
          error: { code: json.error.code, message: json.error.message },
          timestamp: json.timestamp || new Date().toISOString(),
        };
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal confirmCashPayment via backend, mencoba fallback:', e);
    }
    return this.fallback.confirmCashPayment(token, req);
  }

  async getCashAuditLogs(token: string): Promise<ApiResponse<CashAuditLogItem[]>> {
    try {
      const res = await fetch(`${API_BASE}/admin/cash/audit-logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return {
            success: true,
            data: json.data,
            timestamp: json.timestamp || new Date().toISOString(),
          };
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal getCashAuditLogs via backend:', e);
    }
    return this.fallback.getCashAuditLogs(token);
  }

  // 10. Reports
  async getReportsSummary(token: string): Promise<ApiResponse<ReportSummary>> {
    try {
      const res = await fetch(`${API_BASE}/admin/reports/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return {
            success: true,
            data: json.data,
            timestamp: json.timestamp || new Date().toISOString(),
          };
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal getReportsSummary via backend:', e);
    }
    return this.fallback.getReportsSummary(token);
  }

  async getTransactions(token: string, params?: PaginationParams): Promise<ApiResponse<PaginatedResponse<TransactionReportItem>>> {
    try {
      const p = new URLSearchParams();
      if (params?.page) p.set('page', String(params.page));
      if (params?.limit) p.set('limit', String(params.limit));

      const res = await fetch(`${API_BASE}/admin/reports/transactions?${p.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return {
            success: true,
            data: json.data,
            timestamp: json.timestamp || new Date().toISOString(),
          };
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal getTransactions via backend:', e);
    }
    return this.fallback.getTransactions(token, params);
  }

  async exportTransactionsCsv(token: string, params?: { startDate?: string; endDate?: string }): Promise<string> {
    try {
      const p = new URLSearchParams();
      if (params?.startDate) p.set('startDate', params.startDate);
      if (params?.endDate) p.set('endDate', params.endDate);

      const res = await fetch(`${API_BASE}/admin/reports/export/csv?${p.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        return await res.text();
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal exportTransactionsCsv via backend:', e);
    }
    return this.fallback.exportTransactionsCsv(token, params);
  }

  // ==========================================
  // Creative Assets: Fonts & Stickers
  // ==========================================

  async getPublicFonts(): Promise<ApiResponse<FontItem[]>> {
    try {
      const res = await fetch(`${API_BASE}/public/assets/fonts`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json;
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal getPublicFonts via backend:', e);
    }
    return this.fallback.getPublicFonts();
  }

  async getPublicStickers(): Promise<ApiResponse<StickerItem[]>> {
    try {
      const res = await fetch(`${API_BASE}/public/assets/stickers`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json;
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal getPublicStickers via backend:', e);
    }
    return this.fallback.getPublicStickers();
  }

  async getAdminFonts(token: string): Promise<ApiResponse<FontItem[]>> {
    try {
      const res = await fetch(`${API_BASE}/admin/assets/fonts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json;
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal getAdminFonts via backend:', e);
    }
    return this.fallback.getAdminFonts(token);
  }

  async createFont(
    token: string,
    font: { name: string; fontFamily: string; googleFont?: string; previewText?: string }
  ): Promise<ApiResponse<FontItem>> {
    try {
      const res = await fetch(`${API_BASE}/admin/assets/fonts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(font),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal createFont via backend:', e);
    }
    return this.fallback.createFont(token, font);
  }

  async deleteFont(token: string, id: string): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const res = await fetch(`${API_BASE}/admin/assets/fonts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal deleteFont via backend:', e);
    }
    return this.fallback.deleteFont(token, id);
  }

  async getAdminStickers(token: string): Promise<ApiResponse<StickerItem[]>> {
    try {
      const res = await fetch(`${API_BASE}/admin/assets/stickers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json;
        }
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal getAdminStickers via backend:', e);
    }
    return this.fallback.getAdminStickers(token);
  }

  async createSticker(
    token: string,
    sticker: { name: string; category?: string; type: 'emoji' | 'image'; url: string }
  ): Promise<ApiResponse<StickerItem>> {
    try {
      const res = await fetch(`${API_BASE}/admin/assets/stickers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(sticker),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal createSticker via backend:', e);
    }
    return this.fallback.createSticker(token, sticker);
  }

  async deleteSticker(token: string, id: string): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const res = await fetch(`${API_BASE}/admin/assets/stickers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('[HttpApi] Gagal deleteSticker via backend:', e);
    }
    return this.fallback.deleteSticker(token, id);
  }
}

export const httpPhotoboothApi = new HttpPhotoboothApi();
