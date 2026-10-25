import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { useSession } from './contexts/SessionContext';
import { WelcomeScreen } from './pages/customer/WelcomeScreen';
import { PackageSelectionScreen } from './pages/customer/PackageSelectionScreen';
import { PaymentScreen } from './pages/customer/PaymentScreen';
import { CameraScreen } from './pages/customer/CameraScreen';
import { PhotoEditorScreen } from './pages/customer/PhotoEditorScreen';
import { AddPrintScreen } from './pages/customer/AddPrintScreen';
import { DeliveryScreen } from './pages/customer/DeliveryScreen';
import { PinAuthModal } from './components/admin/PinAuthModal';
import { Modal } from './components/common/Modal';
import { Button } from './components/common/Button';
import { useToast } from './components/common/Toast';
import { Clock, ArrowRight, Printer } from 'lucide-react';

const AdminLayout = lazy(() =>
  import('./pages/admin/AdminLayout').then((m) => ({ default: m.AdminLayout }))
);

export const AppContent: React.FC = () => {
  const {
    step,
    session,
    selectedPackage,
    paymentData,
    capturedPhotos,
    setSelectedPhotoUrls,
    finalLayoutImageUrl,
    setFinalLayoutImageUrl,
    editedFrames,
    setEditedFrames,
    selectedPrintItems,
    setSelectedPrintItems,
    additionalPrints,
    selectedTemplateId,
    isProcessing,
    sessionSecondsLeft,
    isSessionTimedOut,
    setIsSessionTimedOut,
    startFlow,
    selectPackage,
    setPaymentVerified,
    addCapturedPhoto,
    deletePhoto,
    goToCamera,
    goToEditor,
    goToAddPrint,
    setAdditionalPrints,
    goToDelivery,
    resetToWelcome,
    cancelSession,
  } = useSession();

  const { showToast } = useToast();
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [autoRedirectSeconds, setAutoRedirectSeconds] = useState(8);

  const handleTimeoutProceed = useCallback(() => {
    setIsSessionTimedOut(false);
    if (capturedPhotos.length > 0) {
      setSelectedPhotoUrls(capturedPhotos);
    }
    goToAddPrint();
  }, [capturedPhotos, goToAddPrint, setIsSessionTimedOut, setSelectedPhotoUrls]);

  // Auto redirect countdown when session time expires
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isSessionTimedOut && (step === 'CAMERA' || step === 'EDITOR')) {
      setAutoRedirectSeconds(8);
      timer = setInterval(() => {
        setAutoRedirectSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleTimeoutProceed();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isSessionTimedOut, step, handleTimeoutProceed]);

  const handleAdminSuccess = (token: string) => {
    setIsAdminModalOpen(false);
    setAdminToken(token);
    showToast({
      type: 'success',
      title: 'Autentikasi PIN Berhasil',
      message: 'Selamat datang di Minja Studio Admin Control Center.',
    });
  };

  const handleExitAdmin = () => {
    setAdminToken(null);
    resetToWelcome();
    showToast({
      type: 'info',
      title: 'Kembali ke Kiosk',
      message: 'Sesi admin ditutup secara aman.',
    });
  };

  // If Admin is authenticated, render the Admin Control Center (Code-Split)
  if (adminToken) {
    return (
      <Suspense
        fallback={
          <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-950 text-white gap-3">
            <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-bold text-slate-300">Memuat Admin Control Center...</span>
          </div>
        }
      >
        <AdminLayout
          token={adminToken}
          onExitToKiosk={handleExitAdmin}
        />
      </Suspense>
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-background text-slate-100 font-sans select-none">
      {/* Customer Screen Router */}
      {step === 'WELCOME' && (
        <WelcomeScreen
          onStartSession={startFlow}
          onAdminTrigger={() => setIsAdminModalOpen(true)}
        />
      )}

      {step === 'PACKAGE' && (
        <PackageSelectionScreen
          onBack={resetToWelcome}
          onProceed={selectPackage}
          isLoading={isProcessing}
        />
      )}

      {step === 'PAYMENT' && paymentData && (
        <PaymentScreen
          payment={paymentData}
          selectedPackage={selectedPackage}
          sessionId={session?.sessionId}
          onPaymentSuccess={setPaymentVerified}
          onCancelSession={cancelSession}
        />
      )}

      {step === 'CAMERA' && (
        <CameraScreen
          maxPhotos={10}
          durationSeconds={selectedPackage?.durationSeconds || 180}
          sessionSecondsLeft={sessionSecondsLeft}
          photos={capturedPhotos}
          onAddPhoto={addCapturedPhoto}
          onDeletePhoto={deletePhoto}
          onFinishCapture={goToEditor}
        />
      )}

      {step === 'EDITOR' && (
        <PhotoEditorScreen
          capturedPhotoUrls={capturedPhotos}
          initialTemplateId={selectedTemplateId}
          sessionSecondsLeft={sessionSecondsLeft}
          onBack={goToCamera}
          onProceed={(allDesigns, finalPhotos) => {
            if (finalPhotos && finalPhotos.length > 0) {
              setSelectedPhotoUrls(finalPhotos);
            }
            if (allDesigns && allDesigns.length > 0) {
              setEditedFrames(allDesigns);
              setFinalLayoutImageUrl(allDesigns[0].layoutUrl);
            }
            goToAddPrint();
          }}
        />
      )}

      {step === 'ADD_PRINT' && selectedPackage && (
        <AddPrintScreen
          pkg={selectedPackage}
          additionalPrints={additionalPrints}
          onUpdateAdditionalPrints={setAdditionalPrints}
          onProceed={(selectedItems) => {
            if (selectedItems && selectedItems.length > 0) {
              setSelectedPrintItems(selectedItems);
            }
            goToDelivery();
          }}
          sessionId={session?.sessionId}
          editedFrames={editedFrames}
          capturedPhotos={capturedPhotos}
        />
      )}

      {step === 'DELIVERY' && (
        <DeliveryScreen
          sessionId={session?.sessionId || ''}
          copies={(selectedPackage?.printCopies || 1) + additionalPrints}
          capturedPhotos={capturedPhotos}
          finalLayoutUrl={finalLayoutImageUrl || capturedPhotos[0]}
          selectedPrintItems={selectedPrintItems}
          onFinishAndReset={resetToWelcome}
        />
      )}

      {/* Admin Protected PIN Modal (Triggered by 5-tap on Welcome Logo) */}
      <PinAuthModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onSuccess={handleAdminSuccess}
      />

      {/* Session Timeout Modal Popup */}
      <Modal
        isOpen={isSessionTimedOut && (step === 'CAMERA' || step === 'EDITOR')}
        showCloseButton={false}
        maxWidth="md"
        title={
          <div className="flex items-center gap-2 text-rose-400 font-black">
            <Clock className="w-5 h-5 animate-pulse" />
            <span>Waktu Sesi Telah Berakhir!</span>
          </div>
        }
      >
        <div className="p-4 space-y-4 text-center">
          <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 border-2 border-rose-400/40 flex items-center justify-center mx-auto shadow-glow-primary animate-pulse">
            <Clock className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-xl font-black text-white">Waktu Sesi Paket Habis</h3>
            <p className="text-xs text-slate-300 mt-1">
              Waktu pemotretan & pengeditan untuk paket Anda ({selectedPackage?.durationSeconds || 180} detik) telah selesai.
            </p>
          </div>

          <div className="glass-panel p-4 rounded-2xl text-xs text-slate-300 text-left space-y-2 border border-white/10">
            <div className="flex items-center gap-2 text-amber-400 font-bold">
              <Printer className="w-4 h-4 text-amber-400" />
              <span>Dialihkan ke Menu Cetak & Scan QR Soft File</span>
            </div>
            <p className="leading-relaxed">
              Foto-foto yang telah Anda ambil akan otomatis diproses untuk pencetakan fisik dan Anda dapat langsung melakukan <strong>Scan QR Code</strong> untuk mengunduh soft file foto ke smartphone Anda.
            </p>
          </div>

          <div className="text-[11px] text-slate-400 font-semibold">
            Otomatis dialihkan dalam <span className="text-amber-400 font-mono font-bold text-sm">{autoRedirectSeconds}</span> detik...
          </div>

          <Button
            variant="gold"
            size="lg"
            onClick={handleTimeoutProceed}
            className="w-full justify-center"
            rightIcon={<ArrowRight className="w-5 h-5" />}
          >
            Lanjut ke Menu Cetak & Scan QR
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default AppContent;
