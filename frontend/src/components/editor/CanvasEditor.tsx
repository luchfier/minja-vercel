import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { TemplateItem } from '../../types/template';
import { FilterPreset, PhotoAdjustment, SlotAdjustment, StickerElement, TextElement } from '../../types/editor';
import { RotateCw, Maximize2, X, Move } from 'lucide-react';
import { PhotoEngine } from '../../photo-engine';

export interface CanvasEditorProps {
  template: TemplateItem;
  photoUrls: string[];
  filter: FilterPreset;
  adjustments: PhotoAdjustment;
  slotAdjustments?: Record<number, SlotAdjustment>;
  selectedSlotIndex?: number | null;
  onSelectSlot?: (index: number | null) => void;
  onUpdateSlotAdjustment?: (index: number, updates: Partial<SlotAdjustment>) => void;
  onDropPhotoOnSlot?: (slotIndex: number, photoUrl: string) => void;
  onSlotTap?: (slotIndex: number) => void;
  stickers: StickerElement[];
  texts: TextElement[];
  selectedElement?: { type: 'sticker' | 'text'; id: string } | null;
  onSelectElement?: (el: { type: 'sticker' | 'text'; id: string } | null) => void;
  onUpdateSticker?: (id: string, updates: Partial<StickerElement>) => void;
  onDeleteSticker?: (id: string) => void;
  onUpdateText?: (id: string, updates: Partial<TextElement>) => void;
  onDeleteText?: (id: string) => void;
  onDragEnd?: () => void;
  onRenderComplete?: (dataUrl: string) => void;
  className?: string;
}

type DragMode = 'none' | 'move' | 'resize' | 'rotate' | 'slot-pan';

export const CanvasEditor: React.FC<CanvasEditorProps> = ({
  template,
  photoUrls,
  filter,
  adjustments,
  slotAdjustments = {},
  selectedSlotIndex = null,
  onSelectSlot,
  onUpdateSlotAdjustment,
  onDropPhotoOnSlot,
  onSlotTap,
  stickers,
  texts,
  selectedElement: propSelectedElement,
  onSelectElement,
  onUpdateSticker,
  onDeleteSticker,
  onUpdateText,
  onDeleteText,
  onDragEnd,
  onRenderComplete,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderCompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRenderedUrlRef = useRef<string>('');
  const slotPointerDownPosRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Hitung dimensi kanvas dinamis (10×15 cm Portrait / Landscape / Strip pada 300 DPI) via PhotoEngine
  const dimensions = useMemo(() => {
    return PhotoEngine.getDimensions(template);
  }, [template]);

  const TARGET_WIDTH = dimensions.width;
  const TARGET_HEIGHT = dimensions.height;

  // Active selected element (internal state synced with prop if controlled)
  const [internalSelectedElement, setInternalSelectedElement] = useState<{
    type: 'sticker' | 'text';
    id: string;
  } | null>(propSelectedElement ?? null);

  useEffect(() => {
    if (propSelectedElement !== undefined) {
      setInternalSelectedElement(propSelectedElement);
    }
  }, [propSelectedElement]);

  const activeElement =
    propSelectedElement !== undefined ? propSelectedElement : internalSelectedElement;

  const setActiveElement = (el: { type: 'sticker' | 'text'; id: string } | null) => {
    setInternalSelectedElement(el);
    if (onSelectElement) onSelectElement(el);
  };

  // Drag interaction state
  const [dragState, setDragState] = useState<{
    mode: DragMode;
    type: 'sticker' | 'text' | 'slot';
    id: string;
    slotIndex?: number;
    initialCanvasX: number;
    initialCanvasY: number;
    elementStartX: number;
    elementStartY: number;
    initialDist: number;
    initialScale: number;
    initialFontSize: number;
    initialAngle: number;
    initialRotation: number;
    currentValDisplay?: string;
  } | null>(null);

  // Convert client viewport coordinate to Canvas 300 DPI coordinate space
  const getCanvasCoords = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      return PhotoEngine.hitTester.getCanvasCoordinates(
        clientX,
        clientY,
        canvas,
        TARGET_WIDTH,
        TARGET_HEIGHT
      );
    },
    [TARGET_WIDTH, TARGET_HEIGHT]
  );

  // Find active element object
  const activeSticker =
    activeElement?.type === 'sticker'
      ? stickers.find((s) => s.id === activeElement.id)
      : null;

  const activeText =
    activeElement?.type === 'text'
      ? texts.find((t) => t.id === activeElement.id)
      : null;

  // Handle pointer down on canvas via PhotoEngine Hit-Testing
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);

    const hit = PhotoEngine.hitTester.test(x, y, template, stickers, texts);

    if (hit.type === 'sticker' && hit.sticker) {
      if (onSelectSlot) onSelectSlot(null);
      setActiveElement({ type: 'sticker', id: hit.sticker.id });
      startInteraction(
        'move',
        'sticker',
        hit.sticker.id,
        x,
        y,
        hit.sticker.x,
        hit.sticker.y,
        hit.sticker.scale || 1,
        32,
        hit.sticker.rotation || 0,
        e
      );
      return;
    }

    if (hit.type === 'text' && hit.text) {
      if (onSelectSlot) onSelectSlot(null);
      setActiveElement({ type: 'text', id: hit.text.id });
      startInteraction(
        'move',
        'text',
        hit.text.id,
        x,
        y,
        hit.text.x,
        hit.text.y,
        1,
        hit.text.fontSize || 32,
        hit.text.rotation || 0,
        e
      );
      return;
    }

    if (hit.type === 'slot' && typeof hit.slotIndex === 'number') {
      setActiveElement(null);
      if (onSelectSlot) onSelectSlot(hit.slotIndex);
      slotPointerDownPosRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
      startSlotPan(hit.slotIndex, x, y, e);
      return;
    }

    // Tapped outside everything
    setActiveElement(null);
    if (onSelectSlot) onSelectSlot(null);
  };

  const startSlotPan = (slotIndex: number, canvasX: number, canvasY: number, e: React.PointerEvent) => {
    e.stopPropagation();
    if (containerRef.current) {
      try {
        containerRef.current.setPointerCapture(e.pointerId);
      } catch {
        // Safe fallback
      }
    }
    const currentAdj = slotAdjustments[slotIndex] || {
      zoom: 1,
      panX: 0,
      panY: 0,
      rotation: 0,
      brightness: 0,
      contrast: 0,
    };
    setDragState({
      mode: 'slot-pan',
      type: 'slot',
      id: `slot_${slotIndex}`,
      slotIndex,
      initialCanvasX: canvasX,
      initialCanvasY: canvasY,
      elementStartX: currentAdj.panX,
      elementStartY: currentAdj.panY,
      initialDist: 1,
      initialScale: currentAdj.zoom,
      initialFontSize: 0,
      initialAngle: 0,
      initialRotation: 0,
      currentValDisplay: `Geser Foto #${slotIndex + 1}`,
    });
  };

  const startInteraction = (
    mode: DragMode,
    type: 'sticker' | 'text',
    id: string,
    canvasX: number,
    canvasY: number,
    elementX: number,
    elementY: number,
    scale: number,
    fontSize: number,
    rotation: number,
    e: React.PointerEvent
  ) => {
    e.stopPropagation();
    if (containerRef.current) {
      try {
        containerRef.current.setPointerCapture(e.pointerId);
      } catch {
        // Safe fallback
      }
    }
    const dx = canvasX - elementX;
    const dy = canvasY - elementY;
    const initialDist = Math.hypot(dx, dy) || 1;
    const initialAngle = Math.atan2(dy, dx) * (180 / Math.PI);

    setDragState({
      mode,
      type,
      id,
      initialCanvasX: canvasX,
      initialCanvasY: canvasY,
      elementStartX: elementX,
      elementStartY: elementY,
      initialDist,
      initialScale: scale,
      initialFontSize: fontSize,
      initialAngle,
      initialRotation: rotation,
      currentValDisplay:
        mode === 'resize'
          ? `${Math.round(scale * 100)}%`
          : mode === 'rotate'
            ? `${Math.round(rotation)}°`
            : undefined,
    });
  };

  const handleGlobalPointerMove = (e: React.PointerEvent) => {
    if (!dragState || dragState.mode === 'none') return;
    e.preventDefault();

    const { x, y } = getCanvasCoords(e.clientX, e.clientY);

    // MODE A: Slot Direct Pan / Crop
    if (dragState.mode === 'slot-pan' && typeof dragState.slotIndex === 'number' && onUpdateSlotAdjustment) {
      const deltaX = x - dragState.initialCanvasX;
      const deltaY = y - dragState.initialCanvasY;
      const newPanX = Math.round(dragState.elementStartX + deltaX);
      const newPanY = Math.round(dragState.elementStartY + deltaY);

      onUpdateSlotAdjustment(dragState.slotIndex, {
        panX: newPanX,
        panY: newPanY,
      });
      return;
    }

    // MODE B: Move Element
    if (dragState.mode === 'move') {
      const deltaX = x - dragState.initialCanvasX;
      const deltaY = y - dragState.initialCanvasY;
      const newX = Math.round(dragState.elementStartX + deltaX);
      const newY = Math.round(dragState.elementStartY + deltaY);

      if (dragState.type === 'sticker' && onUpdateSticker) {
        onUpdateSticker(dragState.id, { x: newX, y: newY });
      } else if (dragState.type === 'text' && onUpdateText) {
        onUpdateText(dragState.id, { x: newX, y: newY });
      }
      return;
    }

    // MODE C: Resize
    if (dragState.mode === 'resize') {
      const dx = x - dragState.elementStartX;
      const dy = y - dragState.elementStartY;
      const currentDist = Math.hypot(dx, dy);
      const ratio = currentDist / dragState.initialDist;

      if (dragState.type === 'sticker' && onUpdateSticker) {
        const newScale = Math.max(0.4, Math.min(3.5, Number((dragState.initialScale * ratio).toFixed(2))));
        onUpdateSticker(dragState.id, { scale: newScale });
        setDragState((prev) =>
          prev ? { ...prev, currentValDisplay: `${Math.round(newScale * 100)}%` } : null
        );
      } else if (dragState.type === 'text' && onUpdateText) {
        const newSize = Math.max(16, Math.min(120, Math.round(dragState.initialFontSize * ratio)));
        onUpdateText(dragState.id, { fontSize: newSize });
        setDragState((prev) =>
          prev ? { ...prev, currentValDisplay: `${newSize}px` } : null
        );
      }
      return;
    }

    // MODE D: Rotate
    if (dragState.mode === 'rotate') {
      const dx = x - dragState.elementStartX;
      const dy = y - dragState.elementStartY;
      const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI);
      let angleDiff = currentAngle - dragState.initialAngle;
      let newRotation = (dragState.initialRotation + angleDiff) % 360;
      if (newRotation < 0) newRotation += 360;

      // Snap to 0, 90, 180, 270 jika dalam toleransi 4 derajat
      [0, 90, 180, 270, 360].forEach((snap) => {
        if (Math.abs(newRotation - snap) < 4) newRotation = snap % 360;
      });

      if (dragState.type === 'sticker' && onUpdateSticker) {
        onUpdateSticker(dragState.id, { rotation: newRotation });
        setDragState((prev) =>
          prev ? { ...prev, currentValDisplay: `${Math.round(newRotation)}°` } : null
        );
      } else if (dragState.type === 'text' && onUpdateText) {
        onUpdateText(dragState.id, { rotation: newRotation });
        setDragState((prev) =>
          prev ? { ...prev, currentValDisplay: `${Math.round(newRotation)}°` } : null
        );
      }
    }
  };

  const handleGlobalPointerUp = (e: React.PointerEvent) => {
    if (dragState && dragState.mode !== 'none') {
      // Deteksi sentuhan tap langsung pada slot foto jika jarak pergeseran < 14px dalam waktu < 650ms
      if (
        dragState.type === 'slot' &&
        typeof dragState.slotIndex === 'number' &&
        slotPointerDownPosRef.current &&
        onSlotTap
      ) {
        const dx = e.clientX - slotPointerDownPosRef.current.x;
        const dy = e.clientY - slotPointerDownPosRef.current.y;
        const dist = Math.hypot(dx, dy);
        const elapsed = Date.now() - slotPointerDownPosRef.current.time;
        if (dist < 14 && elapsed < 650) {
          onSlotTap(dragState.slotIndex);
        }
      }

      slotPointerDownPosRef.current = null;
      setDragState(null);
      if (containerRef.current) {
        try {
          containerRef.current.releasePointerCapture(e.pointerId);
        } catch {
          // Safe fallback
        }
      }
      if (onDragEnd) onDragEnd();
    }
  };

  // Re-render Canvas Content menggunakan PhotoEngine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !template || !template.slots) return;

    let isCancelled = false;

    const renderJob = async () => {
      await PhotoEngine.renderToCanvas(
        canvas,
        {
          template,
          photoUrls,
          filter,
          adjustments,
          slotAdjustments,
          stickers,
          texts,
          selectedSlotIndex,
        },
        {
          isExport: false,
          showEmptySlotHints: true,
          selectedSlotHighlight: true,
        }
      );

      if (isCancelled) return;

      // Debounced onRenderComplete - ekspor data URL saat kanvas stabil
      if (onRenderComplete) {
        if (renderCompleteTimerRef.current) {
          clearTimeout(renderCompleteTimerRef.current);
        }
        renderCompleteTimerRef.current = setTimeout(() => {
          if (!isCancelled && canvasRef.current) {
            try {
              const url = canvasRef.current.toDataURL('image/jpeg', 0.92);
              if (url !== lastRenderedUrlRef.current) {
                lastRenderedUrlRef.current = url;
                onRenderComplete(url);
              }
            } catch {
              // ignore
            }
          }
        }, 300);
      }
    };

    renderJob();

    return () => {
      isCancelled = true;
    };
  }, [
    template,
    photoUrls,
    filter,
    adjustments,
    slotAdjustments,
    selectedSlotIndex,
    stickers,
    texts,
    onRenderComplete,
  ]);

  // Hitung overlay bounding box styling untuk elemen aktif
  let overlayStyle: React.CSSProperties = { display: 'none' };
  let currentRotation = 0;

  if (activeElement && (activeSticker || activeText)) {
    const el = activeSticker || activeText!;
    const posXPercent = (el.x / TARGET_WIDTH) * 100;
    const posYPercent = (el.y / TARGET_HEIGHT) * 100;
    currentRotation = el.rotation || 0;

    const canvas = canvasRef.current;
    const screenScale = canvas && canvas.clientWidth > 0 ? canvas.clientWidth / TARGET_WIDTH : 0.4;

    let boxWidthPx = 100;
    let boxHeightPx = 100;

    if (activeSticker) {
      const stickerScale = activeSticker.scale || 1;
      const canvasDim = 90 * stickerScale;
      boxWidthPx = Math.max(76, canvasDim * screenScale + 32);
      boxHeightPx = Math.max(76, canvasDim * screenScale + 32);
    } else if (activeText) {
      const fontSize = activeText.fontSize || 34;
      const textCanvasFont = fontSize * 1.5;
      const textCanvasWidth = Math.max(120, activeText.text.length * (textCanvasFont * 0.65));
      const textCanvasHeight = textCanvasFont * 1.3;
      boxWidthPx = Math.max(100, textCanvasWidth * screenScale + 36);
      boxHeightPx = Math.max(56, textCanvasHeight * screenScale + 24);
    }

    overlayStyle = {
      position: 'absolute',
      left: `${posXPercent}%`,
      top: `${posYPercent}%`,
      width: `${boxWidthPx}px`,
      height: `${boxHeightPx}px`,
      transform: `translate(-50%, -50%) rotate(${currentRotation}deg)`,
      transformOrigin: 'center center',
      pointerEvents: 'auto',
    };
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const photoUrl =
      e.dataTransfer.getData('text/plain') ||
      e.dataTransfer.getData('photoUrl') ||
      e.dataTransfer.getData('application/photobooth-url');
    if (!photoUrl) return;

    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    // Tambahkan batas toleransi 25px agar pelepasan drop foto ke dalam slot sangat responsif
    const targetSlotIndex = template.slots.findIndex(
      (s) =>
        x >= (s.x - 25) &&
        x <= (s.x + s.width + 25) &&
        y >= (s.y - 25) &&
        y <= (s.y + s.height + 25)
    );

    if (targetSlotIndex !== -1 && onDropPhotoOnSlot) {
      onDropPhotoOnSlot(targetSlotIndex, photoUrl);
    }
  };

  // Aspek rasio dinamis untuk container (Portrait 2/3, Landscape 3/2, Strip 1/3)
  const containerAspectClass =
    dimensions.orientation === 'landscape'
      ? 'aspect-[3/2]'
      : template.layoutType === 'STRIP_2x6'
        ? 'aspect-[1/3]'
        : 'aspect-[2/3]';

  return (
    <div
      ref={containerRef}
      onPointerMove={handleGlobalPointerMove}
      onPointerUp={handleGlobalPointerUp}
      onPointerCancel={handleGlobalPointerUp}
      className={`relative flex flex-col items-center justify-center p-2 select-none ${className}`}
    >
      {/* Studio Preview Container */}
      <div
        className={`relative h-full max-h-[78vh] ${containerAspectClass} rounded-3xl overflow-hidden glass-panel-elevated p-2 shadow-2xl border-2 border-white/15`}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handleCanvasPointerDown}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="w-full h-full object-contain rounded-2xl shadow-lg touch-none"
        />

        {/* Interactive Bounding Box & Resizer/Rotator/Delete Handles */}
        {activeElement && (activeSticker || activeText) && (
          <div
            style={overlayStyle}
            onPointerDown={(e) => {
              const el = activeSticker || activeText!;
              const { x, y } = getCanvasCoords(e.clientX, e.clientY);
              startInteraction(
                'move',
                activeElement.type,
                el.id,
                x,
                y,
                el.x,
                el.y,
                activeSticker ? activeSticker.scale || 1 : 1,
                activeText ? activeText.fontSize || 34 : 34,
                el.rotation || 0,
                e
              );
            }}
            className="border-2 border-dashed border-amber-400 bg-amber-500/10 rounded-2xl cursor-move touch-none flex items-center justify-center shadow-glow-primary transition-colors"
          >
            {/* Center Drag Hint Icon */}
            <div className="p-2 rounded-full bg-slate-950/60 text-amber-400 pointer-events-none border border-white/20">
              <Move className="w-4 h-4 stroke-[2.5]" />
            </div>

            {/* Live Indicator (Ukuran / Rotasi saat ditarik) */}
            {dragState?.currentValDisplay && (
              <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-slate-950/90 text-amber-400 font-mono font-bold text-xs px-2.5 py-1 rounded-full border border-amber-400/50 shadow-lg pointer-events-none whitespace-nowrap">
                {dragState.mode === 'rotate' ? 'Sudut: ' : 'Ukuran: '}
                {dragState.currentValDisplay}
              </div>
            )}

            {/* TOP HANDLE: Rotate Controller */}
            <div
              className="absolute -top-12 left-1/2 -translate-x-1/2 flex flex-col items-center cursor-pointer pointer-events-auto touch-manipulation group"
              onPointerDown={(e) => {
                const el = activeSticker || activeText!;
                const { x, y } = getCanvasCoords(e.clientX, e.clientY);
                startInteraction(
                  'rotate',
                  activeElement.type,
                  el.id,
                  x,
                  y,
                  el.x,
                  el.y,
                  activeSticker ? activeSticker.scale || 1 : 1,
                  activeText ? activeText.fontSize || 34 : 34,
                  el.rotation || 0,
                  e
                );
              }}
              title="Tarik melingkar untuk memutar sudut bebas"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-2xl border-2 border-white touch-manipulation active:scale-95 group-hover:scale-105 transition-transform">
                <RotateCw className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="w-0.5 h-3 bg-emerald-400" />
            </div>

            {/* BOTTOM-RIGHT HANDLE: Resizer Controller */}
            <div
              className="absolute -bottom-4 -right-4 w-11 h-11 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-2xl border-2 border-white cursor-nwse-resize touch-manipulation active:scale-95 hover:scale-105 transition-transform pointer-events-auto group"
              onPointerDown={(e) => {
                const el = activeSticker || activeText!;
                const { x, y } = getCanvasCoords(e.clientX, e.clientY);
                startInteraction(
                  'resize',
                  activeElement.type,
                  el.id,
                  x,
                  y,
                  el.x,
                  el.y,
                  activeSticker ? activeSticker.scale || 1 : 1,
                  activeText ? activeText.fontSize || 34 : 34,
                  el.rotation || 0,
                  e
                );
              }}
              title="Tarik ikon ini untuk memperbesar atau memperkecil bebas"
            >
              <Maximize2 className="w-5 h-5 stroke-[3]" />
            </div>

            {/* TOP-RIGHT HANDLE: Quick Delete Button */}
            <button
              type="button"
              className="absolute -top-4 -right-4 w-9 h-9 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xl border-2 border-white cursor-pointer touch-manipulation active:scale-90 hover:scale-105 transition-transform pointer-events-auto"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (activeElement.type === 'sticker' && onDeleteSticker && activeSticker) {
                  onDeleteSticker(activeSticker.id);
                  setActiveElement(null);
                } else if (activeElement.type === 'text' && onDeleteText && activeText) {
                  onDeleteText(activeText.id);
                  setActiveElement(null);
                }
              }}
              title="Hapus Elemen Ini"
            >
              <X className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
