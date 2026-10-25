import React from 'react';
import { Printer, Check, X, Info } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

export interface Layout4RPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmPrint: () => void;
  templateName: string;
  slotCount: number;
  orientation?: 'portrait' | 'landscape';
  children: React.ReactNode; // Embedded CanvasEditor or rendered layout
}

export const Layout4RPreview: React.FC<Layout4RPreviewProps> = ({
  isOpen,
  onClose,
  onConfirmPrint,
  templateName,
  slotCount,
  orientation = 'portrait',
  children,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="xl" showCloseButton={false}>
      <div className="flex flex-col items-center">
        {/* Top Header */}
        <div className="flex items-center justify-between w-full pb-4 border-b border-white/10 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white">
                Pratinjau Hasil Cetak Fisik
              </h3>
              <p className="text-xs text-slate-400">
                Kertas Foto Studio Berkualitas • Hasil Cetak Tajam & Jernih
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full glass-panel flex items-center justify-center text-slate-300 hover:text-white"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Layout Container with simulated paper shadow */}
        <div className="my-2 relative flex items-center justify-center">
          <div
            className={`relative max-h-[60vh] ${
              orientation === 'landscape' ? 'aspect-[3/2]' : 'aspect-[2/3]'
            } p-3 rounded-2xl bg-white shadow-2xl`}
          >
            {children}
            {/* Safe Margin Guide Overlay */}
            <div className="absolute inset-5 border border-dashed border-red-500/30 pointer-events-none rounded-lg flex items-start justify-end p-1">
              <span className="text-[9px] font-mono text-red-500/70 bg-white/90 px-1 rounded">
                Batas Potong Foto
              </span>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="flex items-center gap-2 p-3 my-3 rounded-2xl glass-panel text-xs text-slate-300 w-full max-w-lg">
          <Info className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>
            Template: <strong>{templateName}</strong> ({slotCount} foto). Komposisi final di-render langsung dari data asli tanpa kompresi screenshot.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-md mt-2">
          <Button variant="ghost" size="lg" onClick={onClose}>
            Kembali Edit
          </Button>

          <Button
            variant="gold"
            size="lg"
            onClick={onConfirmPrint}
            rightIcon={<Check className="w-5 h-5 stroke-[2.5]" />}
          >
            Selesai & Lanjut
          </Button>
        </div>
      </div>
    </Modal>
  );
};
