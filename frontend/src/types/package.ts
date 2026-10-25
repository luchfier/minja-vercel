export interface PackageItem {
  id: string;
  name: string;
  description: string;
  price: number;
  durationSeconds: number; // Durasi sesi foto & edit (dalam detik)
  printCopies: number; // Jumlah lembar cetak fisik 10×15 cm bawaan
  additionalPrintPrice?: number; // Tarif per lembar tambah cetak
  isActive: boolean;
  sortOrder: number;
  badge?: string;
  maxPhotos?: number; // Opsional / deprecated
  maxSelectedPhotos?: number; // Opsional / deprecated
}

export interface CalculatePriceRequest {
  packageId: string;
  additionalPrints: number;
  voucherCode?: string;
}

export interface CalculatePriceResponse {
  packageId: string;
  packageName: string;
  basePrice: number;
  additionalPrints: number;
  additionalPrintUnitPrice: number;
  additionalPrintTotal: number;
  subtotal: number;
  voucherCode?: string;
  voucherName?: string;
  discountAmount: number;
  grossAmount: number;
  voucherError?: string;
}
