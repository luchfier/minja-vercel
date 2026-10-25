// src/services/payment.service.ts
// Service pembayaran (QRIS Midtrans & Cash Desk)
// Sesuai ARCHITECTURE.md §6.4 & API_CONTRACT.md §3.6

import type { PrismaClient, PaymentStatus } from '@prisma/client';
import { AppError, ErrorCode } from '../types/common.types.js';
import { MidtransService } from './midtrans.service.js';
import { verifyPin } from '../utils/auth.util.js';
import type {
  CreatePaymentInput,
  CreateExtraPrintsPaymentInput,
  CashConfirmationInput,
} from '../schemas/payment.schema.js';

export interface PaymentDto {
  id: string;
  orderId: string;
  sessionId: string;
  paymentMethod: 'qris' | 'cash';
  subtotal: number;
  voucherCode: string | null;
  voucherDiscount: number;
  grossAmount: number;
  qrString: string | null;
  qrImageUrl: string | null;
  simulatorUrl?: string | null;
  transactionStatus: PaymentStatus;
  expiryTime: string;
  changeAmount?: number;
  confirmedBy?: string;
  createdAt: string;
}

export interface PaymentStatusResponse {
  orderId: string;
  paymentMethod: 'qris' | 'cash';
  transactionStatus: PaymentStatus;
  settlementTime: string | null;
  isVerified: boolean;
  grossAmount: number;
}

export class PaymentService {
  constructor(
    private prisma: PrismaClient,
    private midtransService: MidtransService
  ) {}

  private mapToDto(payment: any, subtotal?: number): PaymentDto {
    return {
      id: payment.id,
      orderId: payment.orderId,
      sessionId: payment.sessionId,
      paymentMethod: payment.paymentType as 'qris' | 'cash',
      subtotal: subtotal ?? payment.grossAmount,
      voucherCode: null,
      voucherDiscount: 0,
      grossAmount: payment.grossAmount,
      qrString: payment.qrString,
      qrImageUrl: payment.qrImageUrl,
      transactionStatus: payment.transactionStatus,
      expiryTime: payment.expiryTime.toISOString(),
      createdAt: payment.createdAt.toISOString(),
    };
  }

  /**
   * Membuat pembayaran baru (QRIS Midtrans / Cash) untuk sesi
   */
  async createPayment(input: CreatePaymentInput): Promise<PaymentDto> {
    const session = await this.prisma.session.findUnique({
      where: { id: input.sessionId },
      include: {
        payments: true,
        package: true,
      },
    });

    if (!session) {
      throw new AppError(404, ErrorCode.SESSION_NOT_FOUND, 'Sesi tidak ditemukan');
    }

    const settledPayment = session.payments?.find(p => p.transactionStatus === 'settlement');
    if (session.state !== 'AWAITING_PAYMENT') {
      if (settledPayment) {
        throw new AppError(
          400,
          ErrorCode.PAYMENT_ALREADY_SETTLED,
          'Pembayaran untuk sesi ini sudah lunas'
        );
      }
    }

    const pendingPayment = session.payments?.find(p => p.transactionStatus === 'pending');

    // Jika sudah ada pembayaran pending dengan metode yang sama dan belum kadaluarsa, return yang ada
    if (
      pendingPayment &&
      pendingPayment.paymentType === input.paymentMethod &&
      pendingPayment.expiryTime > new Date()
    ) {
      return this.mapToDto(pendingPayment, session.totalPrice);
    }

    // Jika ada pembayaran lama yang pending dengan metode berbeda, hapus dulu
    if (pendingPayment) {
      await this.prisma.webhookEvent.deleteMany({
        where: { paymentId: pendingPayment.id },
      });
      await this.prisma.payment.delete({
        where: { id: pendingPayment.id },
      });
    }

    // Generate Order ID standar: MINJA-YYYYMMDD-XXXX
    const now = new Date();
    const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randSeq = `${Date.now().toString().slice(-4)}${Math.floor(1000 + Math.random() * 9000)}`;
    const orderId = `MINJA-${ymd}-${randSeq}`;

    const grossAmount = session.totalPrice;

    if (input.paymentMethod === 'qris') {
      // 1. Hubungi Midtrans Core API
      const qrisResult = await this.midtransService.createQrisCharge(orderId, grossAmount);

      // 2. Simpan record di PostgreSQL
      const payment = await this.prisma.payment.create({
        data: {
          sessionId: session.id,
          orderId,
          grossAmount,
          paymentType: 'qris',
          transactionStatus: 'pending',
          qrString: qrisResult.qrString,
          qrImageUrl: qrisResult.qrImageUrl,
          midtransId: qrisResult.transactionId,
          isVerified: false,
          expiryTime: qrisResult.expiryTime,
        },
      });

      const dto = this.mapToDto(payment, session.totalPrice);
      dto.simulatorUrl = qrisResult.simulatorUrl || null;
      return dto;
    } else {
      // Cash payment
      const expiryTime = new Date(Date.now() + 15 * 60 * 1000);
      const payment = await this.prisma.payment.create({
        data: {
          sessionId: session.id,
          orderId,
          grossAmount,
          paymentType: 'cash',
          transactionStatus: 'pending',
          isVerified: false,
          expiryTime,
        },
      });

      return this.mapToDto(payment, session.totalPrice);
    }
  }

  /**
   * Membuat transaksi pembayaran untuk lembar cetak tambahan (AddPrint)
   */
  async createExtraPrintsPayment(input: CreateExtraPrintsPaymentInput): Promise<PaymentDto> {
    const session = await this.prisma.session.findUnique({
      where: { id: input.sessionId },
      include: {
        package: true,
      },
    });

    if (!session) {
      throw new AppError(404, ErrorCode.SESSION_NOT_FOUND, 'Sesi tidak ditemukan');
    }

    // Biaya per lembar dari paket atau default 15.000
    const unitPrice = session.package?.additionalPrintPrice || 15000;
    const grossAmount = input.additionalPrints * unitPrice;

    // Generate Order ID standar untuk cetak tambahan: MINJA-EXT-YYYYMMDD-XXXX
    const now = new Date();
    const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randSeq = `${Date.now().toString().slice(-4)}${Math.floor(1000 + Math.random() * 9000)}`;
    const orderId = `MINJA-EXT-${ymd}-${randSeq}`;

    // Charge ke Midtrans API
    const qrisResult = await this.midtransService.createQrisCharge(orderId, grossAmount);

    // Simpan transaksi di database PostgreSQL
    const payment = await this.prisma.payment.create({
      data: {
        sessionId: session.id,
        orderId,
        grossAmount,
        paymentType: input.paymentMethod,
        transactionStatus: 'pending',
        qrString: qrisResult.qrString,
        qrImageUrl: qrisResult.qrImageUrl,
        midtransId: qrisResult.transactionId,
        isVerified: false,
        expiryTime: qrisResult.expiryTime,
      },
    });

    const dto = this.mapToDto(payment, grossAmount);
    dto.simulatorUrl = qrisResult.simulatorUrl || null;
    return dto;
  }

  /**
   * Mengambil status pembayaran dengan rekonsiliasi aktif ke Midtrans
   */
  async getPaymentStatus(orderId: string): Promise<PaymentStatusResponse> {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      include: {
        session: {
          include: { package: true },
        },
      },
    });

    if (!payment) {
      throw new AppError(404, ErrorCode.PAYMENT_NOT_FOUND, 'Transaksi pembayaran tidak ditemukan');
    }

    // Jika masih pending dan tipe QRIS, proaktif tanya Midtrans
    if (payment.transactionStatus === 'pending' && payment.paymentType === 'qris') {
      const midtransStatus = await this.midtransService.checkTransactionStatus(orderId);

      if (midtransStatus) {
        if (
          midtransStatus.transactionStatus === 'settlement' ||
          midtransStatus.transactionStatus === 'capture'
        ) {
          const settlementTime = midtransStatus.settlementTime
            ? new Date(midtransStatus.settlementTime)
            : new Date();

          if (payment.orderId.includes('-EXT-')) {
            const unitPrice = payment.session.package?.additionalPrintPrice || 15000;
            const extraCopies = Math.max(1, Math.round(payment.grossAmount / unitPrice));

            await this.prisma.$transaction([
              this.prisma.payment.update({
                where: { id: payment.id },
                data: {
                  transactionStatus: 'settlement',
                  isVerified: true,
                  settlementTime,
                },
              }),
              this.prisma.session.update({
                where: { id: payment.sessionId },
                data: {
                  additionalPrints: { increment: extraCopies },
                  totalPrints: { increment: extraCopies },
                  additionalPrintCost: { increment: payment.grossAmount },
                  totalPrice: { increment: payment.grossAmount },
                },
              }),
            ]);
          } else {
            await this.prisma.$transaction([
              this.prisma.payment.update({
                where: { id: payment.id },
                data: {
                  transactionStatus: 'settlement',
                  isVerified: true,
                  settlementTime,
                },
              }),
              this.prisma.session.update({
                where: { id: payment.sessionId },
                data: {
                  state: 'PAYMENT_CONFIRMED',
                },
              }),
            ]);
          }

          payment.transactionStatus = 'settlement';
          payment.isVerified = true;
          payment.settlementTime = settlementTime;
        } else if (midtransStatus.transactionStatus === 'expire') {
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: { transactionStatus: 'expire' },
          });
          payment.transactionStatus = 'expire';
        } else if (midtransStatus.transactionStatus === 'cancel') {
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: { transactionStatus: 'cancel' },
          });
          payment.transactionStatus = 'cancel';
        }
      }
    }

    return {
      orderId: payment.orderId,
      paymentMethod: payment.paymentType as 'qris' | 'cash',
      transactionStatus: payment.transactionStatus,
      settlementTime: payment.settlementTime ? payment.settlementTime.toISOString() : null,
      isVerified: payment.isVerified,
      grossAmount: payment.grossAmount,
    };
  }

  /**
   * Menangani notifikasi webhook dari Midtrans
   */
  async handleMidtransWebhook(payload: any): Promise<{ received: boolean; processed: boolean }> {
    const orderId = payload.order_id;
    const statusCode = payload.status_code;
    const grossAmount = payload.gross_amount;
    const transactionStatus = payload.transaction_status;
    const signatureKey = payload.signature_key;

    if (!orderId || !statusCode || !grossAmount || !signatureKey) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Payload webhook Midtrans tidak lengkap');
    }

    const isValid = this.midtransService.verifySignatureKey(
      orderId,
      statusCode,
      grossAmount,
      signatureKey
    );

    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      include: {
        session: {
          include: { package: true },
        },
      },
    });

    if (!payment) {
      return { received: true, processed: false };
    }

    // Catat webhook event
    await this.prisma.webhookEvent.create({
      data: {
        paymentId: payment.id,
        orderId,
        transactionStatus: transactionStatus || 'unknown',
        statusCode,
        signatureValid: isValid,
        rawPayload: payload,
      },
    });

    if (!isValid) {
      throw new AppError(401, ErrorCode.INVALID_WEBHOOK_SIGNATURE, 'Signature webhook tidak valid');
    }

    // Idempotency: Jika transaksi sudah berstatus settlement, kembalikan respon sukses tanpa memproses ulang
    if (payment.transactionStatus === 'settlement' && (transactionStatus === 'settlement' || transactionStatus === 'capture')) {
      return { received: true, processed: true };
    }

    // Amount Tampering Validation: Pastikan nominal webhook cocok dengan tagihan sesi di database
    const incomingGross = Math.round(Number(grossAmount));
    if (incomingGross !== payment.grossAmount) {
      throw new AppError(
        400,
        ErrorCode.VALIDATION_ERROR,
        `Nominal webhook (${incomingGross}) tidak sesuai dengan tagihan terdaftar (${payment.grossAmount})`
      );
    }

    if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
      const settlementTime = payload.settlement_time
        ? new Date(payload.settlement_time)
        : new Date();

      if (payment.orderId.includes('-EXT-')) {
        const unitPrice = payment.session.package?.additionalPrintPrice || 15000;
        const extraCopies = Math.max(1, Math.round(payment.grossAmount / unitPrice));

        await this.prisma.$transaction([
          this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              transactionStatus: 'settlement',
              isVerified: true,
              settlementTime,
            },
          }),
          this.prisma.session.update({
            where: { id: payment.sessionId },
            data: {
              additionalPrints: { increment: extraCopies },
              totalPrints: { increment: extraCopies },
              additionalPrintCost: { increment: payment.grossAmount },
              totalPrice: { increment: payment.grossAmount },
            },
          }),
        ]);
      } else {
        await this.prisma.$transaction([
          this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              transactionStatus: 'settlement',
              isVerified: true,
              settlementTime,
            },
          }),
          this.prisma.session.update({
            where: { id: payment.sessionId },
            data: {
              state: 'PAYMENT_CONFIRMED',
            },
          }),
        ]);
      }
    } else if (transactionStatus === 'expire') {
      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id: payment.id },
          data: { transactionStatus: 'expire' },
        }),
        this.prisma.session.update({
          where: { id: payment.sessionId },
          data: { state: 'EXPIRED' },
        }),
      ]);
    } else if (transactionStatus === 'cancel' || transactionStatus === 'deny') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { transactionStatus: transactionStatus as PaymentStatus },
      });
    }

    return { received: true, processed: true };
  }

  /**
   * Konfirmasi pembayaran tunai oleh petugas loket/kasir menggunakan PIN Admin
   */
  async confirmCashPayment(input: CashConfirmationInput): Promise<{
    success: boolean;
    orderId: string;
    grossAmount: number;
    receivedAmount: number;
    changeAmount: number;
    confirmedBy: string;
    confirmedAt: string;
    message: string;
  }> {
    const pin = input.pin || input.adminPin || '';

    // 1. Verifikasi PIN admin dengan proteksi brute-force & lockout
    const admin = await this.prisma.admin.findFirst();
    if (!admin) {
      throw new AppError(500, ErrorCode.ADMIN_NOT_INITIALIZED, 'Akun admin belum diinisialisasi');
    }

    const now = new Date();
    if (admin.lockedUntil && admin.lockedUntil > now) {
      const remainingMinutes = Math.ceil(
        (admin.lockedUntil.getTime() - now.getTime()) / (60 * 1000)
      );
      throw new AppError(
        423,
        ErrorCode.ADMIN_LOCKED_OUT,
        `Akses admin sedang terkunci karena terlalu banyak percobaan salah. Coba lagi dalam ${remainingMinutes} menit.`,
        { remainingMinutes }
      );
    }

    const isPinValid = await verifyPin(pin, admin.pinHash);
    if (!isPinValid) {
      const newAttempts = admin.failedAttempts + 1;
      let lockedUntil: Date | null = null;
      if (newAttempts >= 5) {
        lockedUntil = new Date(now.getTime() + 10 * 60 * 1000); // 10 menit lockout
      }

      await this.prisma.admin.update({
        where: { id: admin.id },
        data: {
          failedAttempts: newAttempts,
          lockedUntil,
        },
      });

      const sisa = Math.max(0, 5 - newAttempts);
      throw new AppError(
        401,
        ErrorCode.INVALID_PIN,
        lockedUntil
          ? 'PIN salah 5 kali berturut-turut. Akses kasir dikunci selama 10 menit.'
          : `PIN salah. Sisa kesempatan sebelum terkunci: ${sisa} kali.`
      );
    }

    // Reset counter percobaan saat PIN berhasil
    if (admin.failedAttempts > 0) {
      await this.prisma.admin.update({
        where: { id: admin.id },
        data: { failedAttempts: 0, lockedUntil: null },
      });
    }

    // 2. Cari transaksi pembayaran
    const payment = await this.prisma.payment.findUnique({
      where: { orderId: input.orderId },
      include: { session: true },
    });

    if (!payment) {
      throw new AppError(404, ErrorCode.PAYMENT_NOT_FOUND, 'Transaksi tidak ditemukan');
    }

    if (payment.transactionStatus === 'settlement') {
      throw new AppError(
        400,
        ErrorCode.PAYMENT_ALREADY_SETTLED,
        'Transaksi ini sudah lunas dikonfirmasi'
      );
    }

    // 3. Validasi nominal uang
    if (input.receivedAmount < payment.grossAmount) {
      const shortage = payment.grossAmount - input.receivedAmount;
      throw new AppError(
        400,
        ErrorCode.CASH_UNDERPAID,
        `Uang yang diterima kurang Rp ${shortage.toLocaleString('id-ID')}. Total: Rp ${payment.grossAmount.toLocaleString('id-ID')}`
      );
    }

    const changeAmount = input.receivedAmount - payment.grossAmount;
    const operatorId = input.operatorId || 'Petugas Booth';
    const confirmedAt = new Date();

    // 4. Update transaksi & sesi
    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          transactionStatus: 'settlement',
          isVerified: true,
          settlementTime: confirmedAt,
        },
      }),
      this.prisma.session.update({
        where: { id: payment.sessionId },
        data: {
          state: 'PAYMENT_CONFIRMED',
        },
      }),
      this.prisma.auditLog.create({
        data: {
          action: 'CASH_PAYMENT_CONFIRMED',
          details: {
            orderId: payment.orderId,
            operatorId,
            grossAmount: payment.grossAmount,
            receivedAmount: input.receivedAmount,
            changeAmount,
            note: input.cashierNote || 'Konfirmasi tunai di kasir',
          },
        },
      }),
    ]);

    return {
      success: true,
      orderId: payment.orderId,
      grossAmount: payment.grossAmount,
      receivedAmount: input.receivedAmount,
      changeAmount,
      confirmedBy: operatorId,
      confirmedAt: confirmedAt.toISOString(),
      message: 'Pembayaran tunai berhasil dikonfirmasi.',
    };
  }

  /**
   * Helper untuk test mode simulasi pelunasan langsung
   */
  async forceSettlement(orderId: string): Promise<PaymentStatusResponse> {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      include: {
        session: {
          include: { package: true },
        },
      },
    });

    if (!payment) {
      throw new AppError(404, ErrorCode.PAYMENT_NOT_FOUND, 'Transaksi tidak ditemukan');
    }

    const settlementTime = new Date();

    if (payment.orderId.includes('-EXT-')) {
      const unitPrice = payment.session.package?.additionalPrintPrice || 15000;
      const extraCopies = Math.max(1, Math.round(payment.grossAmount / unitPrice));

      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            transactionStatus: 'settlement',
            isVerified: true,
            settlementTime,
          },
        }),
        this.prisma.session.update({
          where: { id: payment.sessionId },
          data: {
            additionalPrints: { increment: extraCopies },
            totalPrints: { increment: extraCopies },
            additionalPrintCost: { increment: payment.grossAmount },
            totalPrice: { increment: payment.grossAmount },
          },
        }),
      ]);
    } else {
      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            transactionStatus: 'settlement',
            isVerified: true,
            settlementTime,
          },
        }),
        this.prisma.session.update({
          where: { id: payment.sessionId },
          data: {
            state: 'PAYMENT_CONFIRMED',
          },
        }),
      ]);
    }

    return {
      orderId: payment.orderId,
      paymentMethod: payment.paymentType as 'qris' | 'cash',
      transactionStatus: 'settlement',
      settlementTime: settlementTime.toISOString(),
      isVerified: true,
      grossAmount: payment.grossAmount,
    };
  }
}
