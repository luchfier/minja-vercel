import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutTemplate,
  Layers,
  Eye,
  Star,
  RefreshCw,
  Upload,
  Plus,
  Trash2,
  Copy,
  AlignCenter,
  RotateCw,
  Magnet,
  Crosshair,
  Rows,
  CheckCircle,
  AlertCircle,
  Check,
  Maximize2,
  SmilePlus,
  Type,
  Image as ImageIcon,
  Edit3,
  Move,
  ZoomIn,
  ZoomOut,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { photoboothApi } from '../../services/photoboothApi';
import { TemplateItem, PhotoSlot } from '../../types/template';
import { FontItem, StickerItem } from '../../types/assets';
import { useToast } from '../../components/common/Toast';
import { Modal } from '../../components/common/Modal';
import { ConfirmationDialog } from '../../components/common/ConfirmationDialog';

interface TemplateManagementPageProps {
  token: string;
}

type StudioTab = 'templates' | 'stickers' | 'fonts';

// Preset slot configurations for rapid import / layout design
const SLOT_PRESETS: { id: string; name: string; count: number; slots: PhotoSlot[] }[] = [
  {
    id: 'duo-vertical',
    name: '2 Foto Vertikal (Duo)',
    count: 2,
    slots: [
      { id: 's1', x: 90, y: 140, width: 1020, height: 710, layerIndex: 1 },
      { id: 's2', x: 90, y: 940, width: 1020, height: 710, layerIndex: 1 },
    ],
  },
  {
    id: 'single-polaroid',
    name: '1 Foto Besar (Polaroid)',
    count: 1,
    slots: [
      { id: 's1', x: 100, y: 120, width: 1000, height: 1240, layerIndex: 1 },
    ],
  },
  {
    id: 'trio-vertical',
    name: '3 Foto Vertikal (Trio)',
    count: 3,
    slots: [
      { id: 's1', x: 90, y: 100, width: 1020, height: 480, layerIndex: 1 },
      { id: 's2', x: 90, y: 640, width: 1020, height: 480, layerIndex: 1 },
      { id: 's3', x: 90, y: 1180, width: 1020, height: 480, layerIndex: 1 },
    ],
  },
  {
    id: 'quad-grid',
    name: '4 Foto Kotak (Grid 2×2)',
    count: 4,
    slots: [
      { id: 's1', x: 70, y: 120, width: 510, height: 720, layerIndex: 1 },
      { id: 's2', x: 620, y: 120, width: 510, height: 720, layerIndex: 1 },
      { id: 's3', x: 70, y: 900, width: 510, height: 720, layerIndex: 1 },
      { id: 's4', x: 620, y: 900, width: 510, height: 720, layerIndex: 1 },
    ],
  },
  {
    id: 'strip-3',
    name: 'Strip Vertikal (3 Foto)',
    count: 3,
    slots: [
      { id: 's1', x: 50, y: 80, width: 500, height: 500, layerIndex: 1 },
      { id: 's2', x: 50, y: 620, width: 500, height: 500, layerIndex: 1 },
      { id: 's3', x: 50, y: 1160, width: 500, height: 500, layerIndex: 1 },
    ],
  },
  {
    id: 'strip-4',
    name: 'Strip Vertikal (4 Foto)',
    count: 4,
    slots: [
      { id: 's1', x: 50, y: 60, width: 500, height: 380, layerIndex: 1 },
      { id: 's2', x: 50, y: 470, width: 500, height: 380, layerIndex: 1 },
      { id: 's3', x: 50, y: 880, width: 500, height: 380, layerIndex: 1 },
      { id: 's4', x: 50, y: 1290, width: 500, height: 380, layerIndex: 1 },
    ],
  },
  {
    id: 'six-grid',
    name: '6 Foto Mini Grid (2×3)',
    count: 6,
    slots: [
      { id: 's1', x: 70, y: 110, width: 510, height: 480, layerIndex: 1 },
      { id: 's2', x: 620, y: 110, width: 510, height: 480, layerIndex: 1 },
      { id: 's3', x: 70, y: 640, width: 510, height: 480, layerIndex: 1 },
      { id: 's4', x: 620, y: 640, width: 510, height: 480, layerIndex: 1 },
      { id: 's5', x: 70, y: 1170, width: 510, height: 480, layerIndex: 1 },
      { id: 's6', x: 620, y: 1170, width: 510, height: 480, layerIndex: 1 },
    ],
  },
];

export const TemplateManagementPage: React.FC<TemplateManagementPageProps> = ({ token }) => {
  const { showToast } = useToast();

  // Active Main Studio Tab
  const [studioTab, setStudioTab] = useState<StudioTab>('templates');

  // ================= TEMPLATE STATE =================
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Template Design / Edit Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importForm, setImportForm] = useState({
    name: '',
    frameUrl: '',
    fileName: '',
    layoutType: '4R_PORTRAIT' as '4R_PORTRAIT' | 'STRIP_2x6' | 'CUSTOM',
    width: 1200,
    height: 1800,
    slots: SLOT_PRESETS[0].slots,
  });
  const [selectedPresetId, setSelectedPresetId] = useState<string>('duo-vertical');
  const [activeSlotIdx, setActiveSlotIdx] = useState<number>(0);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [importError, setImportError] = useState('');

  // Interactive Canvas Preview Container inside Modal
  const previewBoxRef = useRef<HTMLDivElement>(null);
  const [frameLayerMode, setFrameLayerMode] = useState<'edit' | 'preview'>('edit');
  const [frameOpacity, setFrameOpacity] = useState<number>(0.85);
  const [showCoordinatesManual, setShowCoordinatesManual] = useState<boolean>(false);
  const [enableMagneticSnap, setEnableMagneticSnap] = useState<boolean>(true);
  const [activeGuides, setActiveGuides] = useState<{ x?: number; y?: number }>({});
  const [canvasDragState, setCanvasDragState] = useState<{
    mode: 'move' | 'resize';
    slotIndex: number;
    initialPointerX: number;
    initialPointerY: number;
    initialSlotX: number;
    initialSlotY: number;
    initialSlotW: number;
    initialSlotH: number;
  } | null>(null);

  // Delete Template Confirmation State
  const [deletingTemplate, setDeletingTemplate] = useState<TemplateItem | null>(null);

  // Inspector Preview Mode ('slots' shows slot locations on top of frame, 'preview' shows actual print)
  const [inspectorMode, setInspectorMode] = useState<'slots' | 'preview'>('slots');
  const [inspectorFrameOpacity, setInspectorFrameOpacity] = useState<number>(0.85);

  // ================= STICKERS STATE =================
  const [adminStickers, setAdminStickers] = useState<StickerItem[]>([]);
  const [isAddStickerModalOpen, setIsAddStickerModalOpen] = useState(false);
  const [newStickerForm, setNewStickerForm] = useState({
    name: '',
    category: 'Aksesoris',
    type: 'image' as 'image' | 'emoji',
    url: '',
    fileName: '',
  });
  const stickerFileInputRef = useRef<HTMLInputElement>(null);
  const [isSavingSticker, setIsSavingSticker] = useState(false);
  const [deletingSticker, setDeletingSticker] = useState<StickerItem | null>(null);

  // ================= FONTS STATE =================
  const [adminFonts, setAdminFonts] = useState<FontItem[]>([]);
  const [isAddFontModalOpen, setIsAddFontModalOpen] = useState(false);
  const [newFontForm, setNewFontForm] = useState({
    name: '',
    fontFamily: '',
    googleFont: '',
    previewText: 'Momen Indah Photobooth',
  });
  const [isSavingFont, setIsSavingFont] = useState(false);
  const [deletingFont, setDeletingFont] = useState<FontItem | null>(null);

  // Load Templates
  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const res = await photoboothApi.getAdminTemplates(token);
      if (res.success) {
        setTemplates(res.data);
        if (res.data.length > 0) {
          setSelectedTemplate((prev) => {
            const found = res.data.find((t) => t.id === prev?.id);
            return found || res.data[0];
          });
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Load Stickers
  const loadStickers = async () => {
    const res = await photoboothApi.getAdminStickers(token);
    if (res.success) {
      setAdminStickers(res.data);
    }
  };

  // Load Fonts & dynamically inject Google Fonts stylesheets for preview
  const loadFonts = async () => {
    const res = await photoboothApi.getAdminFonts(token);
    if (res.success) {
      setAdminFonts(res.data);
      res.data.forEach((f) => {
        if (f.fontFamily) {
          const cleanName = f.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
          const id = `gfont-admin-${cleanName.toLowerCase().replace(/\s+/g, '-')}`;
          if (!document.getElementById(id)) {
            const link = document.createElement('link');
            link.id = id;
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(cleanName)}:wght@400;700;800&display=swap`;
            document.head.appendChild(link);
          }
        }
      });
    }
  };

  useEffect(() => {
    loadTemplates();
    loadStickers();
    loadFonts();
  }, [token]);

  // Handle PNG File Selection & Conversion to Base64
  const handlePngFileSelect = (file: File) => {
    setImportError('');
    const isPng =
      file.type.toLowerCase().includes('png') ||
      file.name.toLowerCase().endsWith('.png');

    if (!isPng) {
      setImportError('Format file wajib PNG (.png) dengan transparansi.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setImportForm((prev) => ({
          ...prev,
          frameUrl: result,
          fileName: file.name,
          name: prev.name.trim() ? prev.name : file.name.replace(/\.[^/.]+$/, ''),
        }));
      }
    };
    reader.onerror = () => {
      setImportError('Gagal membaca file gambar PNG.');
    };
    reader.readAsDataURL(file);
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = SLOT_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setSelectedPresetId(presetId);
      setImportForm((prev) => ({
        ...prev,
        slots: preset.slots.map((s, idx) => ({ ...s, id: `s${idx + 1}` })),
      }));
      setActiveSlotIdx(0);
    }
  };

  // Add a brand new slot
  const handleAddSlot = () => {
    setImportForm((prev) => {
      const newIdx = prev.slots.length + 1;
      const lastSlot = prev.slots[prev.slots.length - 1];

      let newW = 1000;
      let newH = 650;
      let newX = 100;
      let newY = 150;

      if (lastSlot) {
        newW = lastSlot.width;
        newH = lastSlot.height;
        newX = lastSlot.x;
        newY = lastSlot.y + newH + 30;
        if (newY + newH > (prev.height || 1800) - 50) {
          newY = Math.max(80, (prev.height || 1800) - newH - 50);
          newX = Math.min((prev.width || 1200) - newW - 50, lastSlot.x + 30);
        }
      }

      const newSlot: PhotoSlot = {
        id: `s${newIdx}_${Date.now()}`,
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newW),
        height: Math.round(newH),
        layerIndex: 1,
      };

      return {
        ...prev,
        slots: [...prev.slots, newSlot],
      };
    });
    setActiveSlotIdx(importForm.slots.length);
  };

  // Delete slot
  const handleDeleteSlot = (index: number) => {
    if (importForm.slots.length <= 1) {
      setImportError('Minimal harus ada 1 slot foto.');
      return;
    }
    setImportForm((prev) => ({
      ...prev,
      slots: prev.slots.filter((_, idx) => idx !== index),
    }));
    setActiveSlotIdx((prev) => (prev >= index ? Math.max(0, prev - 1) : prev));
  };

  // Duplicate slot
  const handleDuplicateSlot = (index: number) => {
    setImportForm((prev) => {
      const source = prev.slots[index];
      if (!source) return prev;
      const newSlot: PhotoSlot = {
        ...source,
        id: `s${prev.slots.length + 1}_${Date.now()}`,
        x: Math.min((prev.width || 1200) - source.width, source.x + 40),
        y: Math.min((prev.height || 1800) - source.height, source.y + 40),
      };
      return {
        ...prev,
        slots: [...prev.slots, newSlot],
      };
    });
    setActiveSlotIdx(importForm.slots.length);
  };

  // Center horizontally
  const handleCenterHorizontal = (index: number) => {
    const canvasW = importForm.width || 1200;
    setImportForm((prev) => ({
      ...prev,
      slots: prev.slots.map((s, idx) => {
        if (idx !== index) return s;
        return {
          ...s,
          x: Math.round((canvasW - s.width) / 2),
        };
      }),
    }));
  };

  // Center vertically
  const handleCenterVertical = (index: number) => {
    const canvasH = importForm.height || 1800;
    setImportForm((prev) => ({
      ...prev,
      slots: prev.slots.map((s, idx) => {
        if (idx !== index) return s;
        return {
          ...s,
          y: Math.round((canvasH - s.height) / 2),
        };
      }),
    }));
  };

  // Center both horizontally & vertically
  const handleCenterBoth = (index: number) => {
    const canvasW = importForm.width || 1200;
    const canvasH = importForm.height || 1800;
    setImportForm((prev) => ({
      ...prev,
      slots: prev.slots.map((s, idx) => {
        if (idx !== index) return s;
        return {
          ...s,
          x: Math.round((canvasW - s.width) / 2),
          y: Math.round((canvasH - s.height) / 2),
        };
      }),
    }));
  };

  // Rotate slot 90 degrees (swap width & height)
  const handleRotateSlot = (index: number) => {
    setImportForm((prev) => {
      const slot = prev.slots[index];
      if (!slot) return prev;
      const canvasW = prev.width || 1200;
      const canvasH = prev.height || 1800;

      let newW = slot.height;
      let newH = slot.width;

      if (newW > canvasW - 20) {
        const ratio = newH / newW;
        newW = canvasW - 20;
        newH = Math.round(newW * ratio);
      }
      if (newH > canvasH - 20) {
        const ratio = newW / newH;
        newH = canvasH - 20;
        newW = Math.round(newH * ratio);
      }

      const centerX = slot.x + slot.width / 2;
      const centerY = slot.y + slot.height / 2;
      let newX = Math.round(centerX - newW / 2);
      let newY = Math.round(centerY - newH / 2);

      newX = Math.max(0, Math.min(canvasW - newW, newX));
      newY = Math.max(0, Math.min(canvasH - newH, newY));

      return {
        ...prev,
        slots: prev.slots.map((s, idx) =>
          idx === index ? { ...s, width: newW, height: newH, x: newX, y: newY } : s
        ),
      };
    });
  };

  // Set slot Aspect Ratio (3:2, 4:3, 1:1, 16:9)
  const handleSetAspectRatio = (index: number, ratioW: number, ratioH: number) => {
    setImportForm((prev) => {
      const slot = prev.slots[index];
      if (!slot) return prev;
      const canvasH = prev.height || 1800;
      let newH = Math.round((slot.width * ratioH) / ratioW);
      let newW = slot.width;

      if (newH > canvasH - 40) {
        newH = canvasH - 40;
        newW = Math.round((newH * ratioW) / ratioH);
      }

      const centerY = slot.y + slot.height / 2;
      let newY = Math.round(centerY - newH / 2);
      newY = Math.max(0, Math.min(canvasH - newH, newY));

      return {
        ...prev,
        slots: prev.slots.map((s, idx) =>
          idx === index ? { ...s, width: newW, height: newH, y: newY } : s
        ),
      };
    });
  };



  // Match all slots dimensions to active slot
  const handleMatchAllToActive = (dim: 'both' | 'width' | 'height') => {
    setImportForm((prev) => {
      const target = prev.slots[activeSlotIdx];
      if (!target) return prev;
      const canvasW = prev.width || 1200;
      const canvasH = prev.height || 1800;

      return {
        ...prev,
        slots: prev.slots.map((s, idx) => {
          if (idx === activeSlotIdx) return s;
          const newW = dim === 'height' ? s.width : target.width;
          const newH = dim === 'width' ? s.height : target.height;
          const clampedX = Math.min(canvasW - newW, s.x);
          const clampedY = Math.min(canvasH - newH, s.y);
          return {
            ...s,
            width: newW,
            height: newH,
            x: Math.max(0, clampedX),
            y: Math.max(0, clampedY),
          };
        }),
      };
    });
  };

  // Reorder slot in list (move up / down)
  const handleReorderSlot = (index: number, direction: 'up' | 'down') => {
    setImportForm((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.slots.length) return prev;
      const newSlots = [...prev.slots];
      const temp = newSlots[index];
      newSlots[index] = newSlots[targetIndex];
      newSlots[targetIndex] = temp;
      return { ...prev, slots: newSlots };
    });
    setActiveSlotIdx((prev) => (direction === 'up' ? Math.max(0, prev - 1) : Math.min(importForm.slots.length - 1, prev + 1)));
  };

  // Interactive Drag & Resize Handlers
  const handleSlotPointerDown = (
    e: React.PointerEvent,
    index: number,
    mode: 'move' | 'resize'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveSlotIdx(index);

    const slot = importForm.slots[index];
    if (!slot) return;

    if (previewBoxRef.current) {
      try {
        previewBoxRef.current.setPointerCapture(e.pointerId);
      } catch {
        // safe fallback
      }
    }

    setCanvasDragState({
      mode,
      slotIndex: index,
      initialPointerX: e.clientX,
      initialPointerY: e.clientY,
      initialSlotX: slot.x,
      initialSlotY: slot.y,
      initialSlotW: slot.width,
      initialSlotH: slot.height,
    });
  };

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    if (!canvasDragState) return;
    e.preventDefault();

    const previewBox = previewBoxRef.current;
    if (!previewBox) return;

    const rect = previewBox.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const scaleX = (importForm.width || 1200) / rect.width;
    const scaleY = (importForm.height || 1800) / rect.height;

    const deltaX = (e.clientX - canvasDragState.initialPointerX) * scaleX;
    const deltaY = (e.clientY - canvasDragState.initialPointerY) * scaleY;

    setImportForm((prev) => {
      const modalW = prev.width || 1200;
      const modalH = prev.height || 1800;

      const updatedSlots = prev.slots.map((s, idx) => {
        if (idx !== canvasDragState.slotIndex) return s;

        if (canvasDragState.mode === 'move') {
          const maxX = Math.max(0, modalW - s.width);
          const maxY = Math.max(0, modalH - s.height);
          let rawX = Math.round(Math.max(0, Math.min(maxX, canvasDragState.initialSlotX + deltaX)));
          let rawY = Math.round(Math.max(0, Math.min(maxY, canvasDragState.initialSlotY + deltaY)));

          let guideX: number | undefined = undefined;
          let guideY: number | undefined = undefined;

          if (enableMagneticSnap) {
            const snapThreshold = 20;

            // 1. Center of Canvas Horizontal
            const centerH = Math.round((modalW - s.width) / 2);
            if (Math.abs(rawX - centerH) <= snapThreshold) {
              rawX = centerH;
              guideX = modalW / 2;
            }

            // 2. Center of Canvas Vertical
            const centerV = Math.round((modalH - s.height) / 2);
            if (Math.abs(rawY - centerV) <= snapThreshold) {
              rawY = centerV;
              guideY = modalH / 2;
            }

            // 3. Sibling slots alignment matching
            prev.slots.forEach((sib, sIdx) => {
              if (sIdx === canvasDragState.slotIndex) return;

              // Sibling Left match
              if (Math.abs(rawX - sib.x) <= snapThreshold) {
                rawX = sib.x;
                guideX = sib.x;
              }
              // Sibling Center X match
              const sibCenterX = sib.x + sib.width / 2;
              const myCenterX = rawX + s.width / 2;
              if (Math.abs(myCenterX - sibCenterX) <= snapThreshold) {
                rawX = Math.round(sibCenterX - s.width / 2);
                guideX = sibCenterX;
              }
              // Sibling Right match
              const sibRight = sib.x + sib.width;
              if (Math.abs(rawX + s.width - sibRight) <= snapThreshold) {
                rawX = sibRight - s.width;
                guideX = sibRight;
              }

              // Sibling Top match
              if (Math.abs(rawY - sib.y) <= snapThreshold) {
                rawY = sib.y;
                guideY = sib.y;
              }
              // Sibling Center Y match
              const sibCenterY = sib.y + sib.height / 2;
              const myCenterY = rawY + s.height / 2;
              if (Math.abs(myCenterY - sibCenterY) <= snapThreshold) {
                rawY = Math.round(sibCenterY - s.height / 2);
                guideY = sibCenterY;
              }
              // Sibling Bottom match
              const sibBottom = sib.y + sib.height;
              if (Math.abs(rawY + s.height - sibBottom) <= snapThreshold) {
                rawY = sibBottom - s.height;
                guideY = sibBottom;
              }
            });
          }

          setActiveGuides({ x: guideX, y: guideY });
          return { ...s, x: rawX, y: rawY };
        }

        if (canvasDragState.mode === 'resize') {
          const maxW = modalW - s.x;
          const maxH = modalH - s.y;
          const newW = Math.round(Math.max(120, Math.min(maxW, canvasDragState.initialSlotW + deltaX)));
          const newH = Math.round(Math.max(120, Math.min(maxH, canvasDragState.initialSlotH + deltaY)));
          return { ...s, width: newW, height: newH };
        }

        return s;
      });

      return { ...prev, slots: updatedSlots };
    });
  };

  const handleCanvasPointerUp = (e: React.PointerEvent) => {
    setActiveGuides({});
    if (canvasDragState) {
      setCanvasDragState(null);
      if (previewBoxRef.current) {
        try {
          previewBoxRef.current.releasePointerCapture(e.pointerId);
        } catch {
          // safe fallback
        }
      }
    }
  };

  // Scale slot up or down (+10% / -10%)
  const handleScaleSlot = (index: number, multiplier: number) => {
    setImportForm((prev) => {
      const slot = prev.slots[index];
      if (!slot) return prev;
      const modalW = prev.width || 1200;
      const modalH = prev.height || 1800;
      const newW = Math.round(Math.max(120, Math.min(modalW - 20, slot.width * multiplier)));
      const newH = Math.round(Math.max(120, Math.min(modalH - 20, slot.height * multiplier)));
      const deltaW = newW - slot.width;
      const deltaH = newH - slot.height;
      const newX = Math.max(0, Math.min(modalW - newW, Math.round(slot.x - deltaW / 2)));
      const newY = Math.max(0, Math.min(modalH - newH, Math.round(slot.y - deltaH / 2)));

      return {
        ...prev,
        slots: prev.slots.map((s, i) => (i === index ? { ...s, width: newW, height: newH, x: newX, y: newY } : s)),
      };
    });
  };

  // Nudge slot position by delta X and delta Y (e.g. 20px)
  const handleNudgeSlot = (index: number, dx: number, dy: number) => {
    setImportForm((prev) => {
      const slot = prev.slots[index];
      if (!slot) return prev;
      const modalW = prev.width || 1200;
      const modalH = prev.height || 1800;
      const newX = Math.round(Math.max(0, Math.min(modalW - slot.width, slot.x + dx)));
      const newY = Math.round(Math.max(0, Math.min(modalH - slot.height, slot.y + dy)));

      return {
        ...prev,
        slots: prev.slots.map((s, i) => (i === index ? { ...s, x: newX, y: newY } : s)),
      };
    });
  };

  // Adjust width or height
  const handleAdjustDimension = (index: number, dw: number, dh: number) => {
    setImportForm((prev) => {
      const slot = prev.slots[index];
      if (!slot) return prev;
      const modalW = prev.width || 1200;
      const modalH = prev.height || 1800;
      const newW = Math.round(Math.max(120, Math.min(modalW - slot.x, slot.width + dw)));
      const newH = Math.round(Math.max(120, Math.min(modalH - slot.y, slot.height + dh)));

      return {
        ...prev,
        slots: prev.slots.map((s, i) => (i === index ? { ...s, width: newW, height: newH } : s)),
      };
    });
  };

  // Open Create New Template Modal
  const handleOpenCreateModal = () => {
    setEditingTemplateId(null);
    setImportError('');
    setImportForm({
      name: '',
      frameUrl: '',
      fileName: '',
      layoutType: '4R_PORTRAIT',
      width: 1200,
      height: 1800,
      slots: [...SLOT_PRESETS[0].slots],
    });
    setSelectedPresetId('duo-vertical');
    setActiveSlotIdx(0);
    setIsImportModalOpen(true);
  };

  // Open Edit Existing Template Modal
  const handleOpenEditModal = (tpl: TemplateItem) => {
    setEditingTemplateId(tpl.id);
    setImportError('');
    const loadedSlots = Array.isArray(tpl.slots) && tpl.slots.length > 0
      ? JSON.parse(JSON.stringify(tpl.slots))
      : JSON.parse(JSON.stringify(SLOT_PRESETS[0].slots));

    setImportForm({
      name: tpl.name,
      frameUrl: tpl.frameUrl || '',
      fileName: `${tpl.name}.png`,
      layoutType: (tpl.layoutType as any) || '4R_PORTRAIT',
      width: tpl.width || 1200,
      height: tpl.height || 1800,
      slots: loadedSlots,
    });
    setActiveSlotIdx(0);
    setIsImportModalOpen(true);
  };

  // Save or Update Template
  const handleSaveImportedTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError('');

    if (!importForm.name.trim()) {
      setImportError('Nama template wajib diisi.');
      return;
    }
    if (!importForm.frameUrl) {
      setImportError('File gambar frame PNG transparan wajib diupload.');
      return;
    }
    if (importForm.slots.length === 0) {
      setImportError('Minimal 1 slot foto harus ditentukan.');
      return;
    }

    // Sanitize all slot values so they meet backend Zod validation (positive, integer, non-negative)
    const sanitizedSlots: PhotoSlot[] = importForm.slots.map((s, idx) => ({
      id: s.id || `s${idx + 1}`,
      x: Math.max(0, Math.round(Number(s.x) || 0)),
      y: Math.max(0, Math.round(Number(s.y) || 0)),
      width: Math.max(50, Math.round(Number(s.width) || 100)),
      height: Math.max(50, Math.round(Number(s.height) || 100)),
      rotation: Math.round(Number(s.rotation) || 0),
      layerIndex: 1,
    }));

    setIsSavingTemplate(true);
    try {
      let res;
      if (editingTemplateId) {
        // Update existing template
        res = await photoboothApi.updateTemplate(token, editingTemplateId, {
          name: importForm.name.trim(),
          thumbnailUrl: '',
          frameUrl: importForm.frameUrl,
          layoutType: importForm.layoutType,
          width: importForm.width || 1200,
          height: importForm.height || 1800,
          slots: sanitizedSlots,
          isActive: true,
        });
      } else {
        // Create brand new template
        res = await photoboothApi.createTemplate(token, {
          name: importForm.name.trim(),
          thumbnailUrl: '',
          frameUrl: importForm.frameUrl,
          layoutType: importForm.layoutType,
          width: importForm.width || 1200,
          height: importForm.height || 1800,
          slots: sanitizedSlots,
          isActive: true,
          isDefault: false,
        });
      }

      if (res.success) {
        const savedTpl: TemplateItem = {
          ...res.data,
          slots: Array.isArray(res.data.slots) && res.data.slots.length > 0 ? res.data.slots : sanitizedSlots,
          width: res.data.width || importForm.width || 1200,
          height: res.data.height || importForm.height || 1800,
          layoutType: res.data.layoutType || importForm.layoutType,
          frameUrl: res.data.frameUrl || importForm.frameUrl,
        };
        showToast({
          type: 'success',
          title: editingTemplateId ? 'Template Berhasil Diperbarui!' : 'Frame PNG Berhasil Disimpan!',
          message: `Template "${savedTpl.name}" dengan ${savedTpl.slots.length} slot foto kini aktif di kiosk.`,
        });
        setIsImportModalOpen(false);
        setTemplates((prev) => {
          if (editingTemplateId) {
            return prev.map((t) => (t.id === savedTpl.id ? savedTpl : t));
          }
          return [savedTpl, ...prev.filter((t) => t.id !== savedTpl.id)];
        });
        setSelectedTemplate(savedTpl);

        // Silently sync background templates list without resetting selected template or showing global spinner
        photoboothApi.getAdminTemplates(token).then((bgRes) => {
          if (bgRes.success && bgRes.data) {
            setTemplates(bgRes.data);
            const found = bgRes.data.find((t) => t.id === savedTpl.id);
            if (found) {
              setSelectedTemplate(found);
            }
          }
        }).catch(() => {});
      } else {
        const errorMsg = res.error?.message || 'Gagal menyimpan template ke server.';
        setImportError(errorMsg);
        showToast({
          type: 'error',
          title: 'Gagal Menyimpan Template',
          message: errorMsg,
        });
      }
    } catch (err: any) {
      const errText = err?.message || 'Terjadi kesalahan sistem saat menyimpan frame.';
      setImportError(errText);
      showToast({
        type: 'error',
        title: 'Error Sistem',
        message: errText,
      });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleToggleActive = async (tpl: TemplateItem) => {
    const updatedStatus = !tpl.isActive;
    setTemplates((prev) =>
      prev.map((t) => (t.id === tpl.id ? { ...t, isActive: updatedStatus } : t))
    );
    if (selectedTemplate?.id === tpl.id) {
      setSelectedTemplate({ ...selectedTemplate, isActive: updatedStatus });
    }

    const res = await photoboothApi.updateTemplate(token, tpl.id, { isActive: updatedStatus });
    if (res.success) {
      showToast({
        type: 'info',
        title: updatedStatus ? 'Template Diaktifkan' : 'Template Dinonaktifkan',
        message: `Template "${tpl.name}" sekarang ${updatedStatus ? 'Tampil' : 'Disembunyikan'} pada editor foto.`,
      });
    } else {
      setTemplates((prev) =>
        prev.map((t) => (t.id === tpl.id ? { ...t, isActive: tpl.isActive } : t))
      );
      showToast({
        type: 'error',
        title: 'Gagal Mengubah Status',
        message: res.error?.message || 'Gagal memperbarui status template.',
      });
    }
  };

  const handleSetDefault = async (tpl: TemplateItem) => {
    setTemplates((prev) =>
      prev.map((t) => ({ ...t, isDefault: t.id === tpl.id }))
    );
    if (selectedTemplate) {
      setSelectedTemplate((prev) => (prev ? { ...prev, isDefault: prev.id === tpl.id } : null));
    }

    const res = await photoboothApi.updateTemplate(token, tpl.id, { isDefault: true });
    if (res.success) {
      showToast({
        type: 'success',
        title: 'Template Default Diperbarui',
        message: `"${tpl.name}" kini menjadi layout otomatis saat sesi editor dibuka.`,
      });
    } else {
      loadTemplates();
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deletingTemplate) return;
    const targetId = deletingTemplate.id;
    const targetName = deletingTemplate.name;

    setTemplates((prev) => {
      const remaining = prev.filter((t) => t.id !== targetId);
      if (selectedTemplate?.id === targetId) {
        setSelectedTemplate(remaining.length > 0 ? remaining[0] : null);
      }
      return remaining;
    });
    setDeletingTemplate(null);

    const res = await photoboothApi.deleteTemplate(token, targetId);
    if (res.success) {
      showToast({
        type: 'warning',
        title: 'Template Dihapus',
        message: `Template "${targetName}" telah dihapus secara permanen.`,
      });
      loadTemplates();
    } else {
      showToast({
        type: 'error',
        title: 'Gagal Menghapus Template',
        message: res.error?.message || 'Terjadi kesalahan saat menghapus template.',
      });
      loadTemplates();
    }
  };

  // ================= STICKER HANDLERS =================
  const handleStickerFileSelect = (file: File) => {
    const isPng = file.type.toLowerCase().includes('png') || file.name.toLowerCase().endsWith('.png');
    if (!isPng) {
      showToast({ type: 'error', title: 'File Bukan PNG', message: 'Stiker kustom wajib bertipe PNG transparan.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setNewStickerForm((prev) => ({
          ...prev,
          url: result,
          fileName: file.name,
          name: prev.name.trim() ? prev.name : file.name.replace(/\.[^/.]+$/, ''),
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSticker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStickerForm.name.trim() || !newStickerForm.url.trim()) {
      showToast({ type: 'warning', title: 'Form Belum Lengkap', message: 'Nama stiker dan konten wajib diisi.' });
      return;
    }

    setIsSavingSticker(true);
    try {
      const res = await photoboothApi.createSticker(token, {
        name: newStickerForm.name.trim(),
        category: newStickerForm.category.trim() || 'Aksesoris',
        type: newStickerForm.type,
        url: newStickerForm.url.trim(),
      });
      if (res.success) {
        showToast({ type: 'success', title: 'Stiker Berhasil Ditambahkan', message: `Stiker "${res.data.name}" kini aktif di studio.` });
        setIsAddStickerModalOpen(false);
        setNewStickerForm({ name: '', category: 'Aksesoris', type: 'image', url: '', fileName: '' });
        loadStickers();
      } else {
        showToast({ type: 'error', title: 'Gagal Menambah Stiker', message: res.error?.message || 'Terjadi kesalahan.' });
      }
    } finally {
      setIsSavingSticker(false);
    }
  };

  const handleDeleteSticker = async () => {
    if (!deletingSticker) return;
    const target = deletingSticker;
    setDeletingSticker(null);
    setAdminStickers((prev) => prev.filter((s) => s.id !== target.id));
    const res = await photoboothApi.deleteSticker(token, target.id);
    if (res.success) {
      showToast({ type: 'warning', title: 'Stiker Dihapus', message: `Stiker "${target.name}" telah dihapus.` });
      loadStickers();
    }
  };

  // ================= FONT HANDLERS =================
  const handleSaveFont = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFontForm.name.trim() || !newFontForm.fontFamily.trim()) {
      showToast({ type: 'warning', title: 'Form Belum Lengkap', message: 'Nama font dan font family wajib diisi.' });
      return;
    }

    setIsSavingFont(true);
    try {
      const res = await photoboothApi.createFont(token, {
        name: newFontForm.name.trim(),
        fontFamily: newFontForm.fontFamily.trim(),
        googleFont: newFontForm.googleFont.trim() || newFontForm.fontFamily.trim(),
        previewText: newFontForm.previewText.trim() || newFontForm.name.trim(),
      });
      if (res.success) {
        showToast({ type: 'success', title: 'Font Baru Berhasil Ditambahkan', message: `Font "${res.data.name}" kini aktif di studio.` });
        setIsAddFontModalOpen(false);
        setNewFontForm({ name: '', fontFamily: '', googleFont: '', previewText: 'Momen Indah Photobooth' });
        loadFonts();
      } else {
        showToast({ type: 'error', title: 'Gagal Menambah Font', message: res.error?.message || 'Terjadi kesalahan.' });
      }
    } finally {
      setIsSavingFont(false);
    }
  };

  const handleDeleteFont = async () => {
    if (!deletingFont) return;
    const target = deletingFont;
    setDeletingFont(null);
    setAdminFonts((prev) => prev.filter((f) => f.id !== target.id));
    const res = await photoboothApi.deleteFont(token, target.id);
    if (res.success) {
      showToast({ type: 'warning', title: 'Font Dihapus', message: `Font "${target.name}" telah dihapus.` });
      loadFonts();
    }
  };

  const currentActiveSlot = importForm.slots[activeSlotIdx] || importForm.slots[0];
  const modalCanvasW = importForm.width || 1200;
  const modalCanvasH = importForm.height || 1800;

  return (
    <div className="space-y-6">
      {/* Header Studio */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-amber-400" />
            <span>Studio Desain Kreatif: Frame, Stiker & Tipografi</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Kelola template bingkai cetak, tambah stiker PNG kustom, dan perluas ragam font tipografi untuk pelanggan kiosk.
          </p>
        </div>

        {/* 3 Main Studio Sub-Tabs */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/[0.04] border border-white/10 shrink-0">
          <button
            type="button"
            onClick={() => setStudioTab('templates')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              studioTab === 'templates'
                ? 'bg-amber-500 text-slate-950 shadow-glow-primary font-black'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <LayoutTemplate className="w-4 h-4" />
            <span>Frame Cetak ({templates.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setStudioTab('stickers')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              studioTab === 'stickers'
                ? 'bg-amber-500 text-slate-950 shadow-glow-primary font-black'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <SmilePlus className="w-4 h-4" />
            <span>Stiker PNG & Emoji ({adminStickers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setStudioTab('fonts')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              studioTab === 'fonts'
                ? 'bg-amber-500 text-slate-950 shadow-glow-primary font-black'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Type className="w-4 h-4" />
            <span>Font Tipografi ({adminFonts.length})</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: FRAME & TATA LETAK SLOT TEMPLATE                  */}
      {/* ======================================================== */}
      {studioTab === 'templates' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">
              Katalog Frame Aktif Kiosk ({templates.length} Desain)
            </span>

            <div className="flex items-center gap-3">
              <button
                onClick={loadTemplates}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/10 active:scale-95 text-slate-300 text-xs font-medium border border-white/10 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
                <span>Segarkan</span>
              </button>

              <button
                onClick={handleOpenCreateModal}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:scale-95 text-slate-950 text-xs font-bold shadow-glow-primary transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Import Frame PNG Baru</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Templates Grid (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {templates.map((tpl) => {
                  const isSelected = selectedTemplate?.id === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => setSelectedTemplate(tpl)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500/40 shadow-glow-primary/20 ring-1 ring-amber-500/30'
                          : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                              <span className="truncate max-w-[150px]">{tpl.name}</span>
                              {tpl.isDefault && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 shrink-0">
                                  <Star className="w-2.5 h-2.5 fill-amber-300" />
                                  <span>Default</span>
                                </span>
                              )}
                            </h3>
                            <span className="text-[11px] text-slate-400">
                              {tpl.slots.length} Slot Foto • {tpl.layoutType === 'STRIP_2x6' ? '5 × 15 cm' : (tpl.width && tpl.height ? `${Math.round(tpl.width / 120)} × ${Math.round(tpl.height / 120)} cm` : '10 × 15 cm')}
                            </span>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                              tpl.isActive
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                            }`}
                          >
                            {tpl.isActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </div>

                        {/* Template Thumbnail with Real Frame PNG rendering */}
                        <div className="w-full h-36 bg-slate-950/80 rounded-xl border border-white/10 p-2 relative overflow-hidden flex items-center justify-center my-2">
                          <div
                            style={{
                              width: (tpl.layoutType === 'STRIP_2x6' || (tpl.width && tpl.height && tpl.width / tpl.height < 0.5)) ? '54px' : '96px',
                              height: '136px',
                            }}
                            className="bg-[#141B2D] border border-white/20 rounded-lg relative overflow-hidden shadow-inner flex items-center justify-center"
                          >
                            {/* Slots (Displayed on top at z-20 so location is always clearly visible) */}
                            {tpl.slots.map((slot, idx) => {
                              const leftPct = (slot.x / (tpl.width || 1200)) * 100;
                              const topPct = (slot.y / (tpl.height || 1800)) * 100;
                              const widthPct = (slot.width / (tpl.width || 1200)) * 100;
                              const heightPct = (slot.height / (tpl.height || 1800)) * 100;
                              return (
                                <div
                                  key={slot.id || idx}
                                  style={{
                                    left: `${leftPct}%`,
                                    top: `${topPct}%`,
                                    width: `${widthPct}%`,
                                    height: `${heightPct}%`,
                                  }}
                                  className="absolute bg-sky-500/35 border border-sky-300 rounded-xs flex items-center justify-center z-20 pointer-events-none shadow-sm"
                                >
                                  <span className="text-[7px] font-black text-sky-100 bg-slate-950/80 px-0.5 rounded leading-none">#{idx + 1}</span>
                                </div>
                              );
                            })}

                            {/* Frame PNG Overlay (if present) */}
                            {tpl.frameUrl && (
                              <img
                                src={tpl.frameUrl}
                                alt="Frame Overlay"
                                className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10 opacity-80"
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card Actions: Edit, Set Default, Toggle, Delete */}
                      <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(tpl);
                            }}
                            className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                            title="Edit template & atur ulang slot foto"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleActive(tpl);
                            }}
                            className="text-slate-300 hover:text-white font-medium cursor-pointer"
                          >
                            {tpl.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          {!tpl.isDefault && tpl.isActive && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetDefault(tpl);
                              }}
                              className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Star className="w-3 h-3" />
                              <span>Set Default</span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={templates.length <= 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (templates.length <= 1) {
                                showToast({
                                  type: 'info',
                                  title: 'Tidak Bisa Dihapus',
                                  message: 'Kiosk wajib memiliki minimal 1 template frame aktif.',
                                });
                                return;
                              }
                              setDeletingTemplate(tpl);
                            }}
                            className={`p-1 rounded transition-colors ${
                              templates.length <= 1
                                ? 'text-slate-600 cursor-not-allowed opacity-40'
                                : 'text-slate-400 hover:text-rose-400 cursor-pointer'
                            }`}
                            title="Hapus Template"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Template Slot Inspector (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              {selectedTemplate ? (
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Eye className="w-4 h-4 text-amber-400" />
                        <span>Inspektor & Pratinjau Frame</span>
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {selectedTemplate.name} • {selectedTemplate.slots.length} Slot Foto
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(selectedTemplate)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs font-bold shadow-glow-primary transition-all cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Template</span>
                    </button>
                  </div>

                  {/* Mode Tampilan Inspektor: Garis Slot Kanvas vs Hasil Cetak Asli */}
                  <div className="w-full flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-white/10">
                    <div className="flex items-center gap-1 p-0.5 rounded-xl bg-white/[0.05] border border-white/10">
                      <button
                        type="button"
                        onClick={() => setInspectorMode('slots')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          inspectorMode === 'slots'
                            ? 'bg-sky-500 text-slate-950 shadow-sm'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Lokasi Kanvas Foto</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setInspectorMode('preview')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          inspectorMode === 'preview'
                            ? 'bg-amber-500 text-slate-950 shadow-sm'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Hasil Cetak Asli</span>
                      </button>
                    </div>

                    {/* Frame Opacity quick toggle in slots mode */}
                    {selectedTemplate.frameUrl && inspectorMode === 'slots' && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <span>Transparansi:</span>
                        {[0.5, 0.85, 1.0].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setInspectorFrameOpacity(val)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                              inspectorFrameOpacity === val
                                ? 'bg-sky-400 text-slate-950'
                                : 'bg-white/5 text-slate-400 hover:text-white'
                            }`}
                          >
                            {Math.round(val * 100)}%
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Large Visual Canvas Display with Frame PNG + Sample Photo Slots */}
                  <div className="w-full flex justify-center py-2">
                    <div
                      style={{
                        width: (selectedTemplate.layoutType === 'STRIP_2x6' || (selectedTemplate.width && selectedTemplate.height && selectedTemplate.width / selectedTemplate.height < 0.5)) ? '150px' : '230px',
                        height: '345px',
                      }}
                      className="bg-slate-950 rounded-xl border-2 border-white/20 shadow-2xl relative overflow-hidden flex items-center justify-center select-none"
                    >
                      {/* Grid Lines Pembantu */}
                      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

                      {/* Frame PNG Background (jika mode 'slots', letakkan di BELAKANG z-10 agar garis slot foto di depan kelihatan jelas) */}
                      {selectedTemplate.frameUrl && inspectorMode === 'slots' && (
                        <img
                          src={selectedTemplate.frameUrl}
                          alt="Frame Background"
                          style={{ opacity: inspectorFrameOpacity }}
                          className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10 transition-opacity"
                        />
                      )}

                      {/* Photo Canvas Slots */}
                      {selectedTemplate.slots.map((slot, index) => {
                        const canvasW = selectedTemplate.width || 1200;
                        const canvasH = selectedTemplate.height || 1800;
                        const leftPct = (slot.x / canvasW) * 100;
                        const topPct = (slot.y / canvasH) * 100;
                        const widthPct = (slot.width / canvasW) * 100;
                        const heightPct = (slot.height / canvasH) * 100;
                        return (
                          <div
                            key={slot.id || index}
                            style={{
                              left: `${leftPct}%`,
                              top: `${topPct}%`,
                              width: `${widthPct}%`,
                              height: `${heightPct}%`,
                            }}
                            className={`absolute rounded transition-all flex flex-col items-center justify-between p-1 text-center pointer-events-none ${
                              inspectorMode === 'slots'
                                ? 'bg-sky-500/30 border-2 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.5)] z-20'
                                : 'bg-gradient-to-tr from-sky-900 to-indigo-900 border border-sky-400/40 z-10'
                            }`}
                          >
                            <div className="w-full flex items-center justify-between text-[8px] font-mono">
                              <span className="px-1 rounded bg-sky-400 text-slate-950 font-black shadow-sm">
                                #{index + 1}
                              </span>
                              <span className="text-white/80 bg-slate-950/80 px-0.5 rounded font-bold">
                                {slot.width}×{slot.height}
                              </span>
                            </div>

                            <div className="text-[8px] text-sky-200 font-mono bg-slate-950/70 px-1 rounded mt-auto">
                              X:{slot.x} Y:{slot.y}
                            </div>
                          </div>
                        );
                      })}

                      {/* Frame PNG Foreground (jika mode 'preview', letakkan di DEPAN z-20) */}
                      {selectedTemplate.frameUrl && inspectorMode === 'preview' && (
                        <img
                          src={selectedTemplate.frameUrl}
                          alt="Frame Overlay"
                          className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20"
                        />
                      )}
                    </div>
                  </div>

                  {/* Slots Coordinate Table */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-sky-400" />
                      <span>Daftar Slot Koordinat Foto ({selectedTemplate.slots.length} Slot)</span>
                    </h4>

                    <div className="overflow-x-auto rounded-xl border border-white/10 max-h-48 custom-scrollbar">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-white/[0.04] text-[10px] uppercase text-slate-400 font-mono">
                          <tr>
                            <th className="py-2 px-3">Slot</th>
                            <th className="py-2 px-3">Posisi (X, Y)</th>
                            <th className="py-2 px-3">Ukuran (W × H)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                          {selectedTemplate.slots.map((slot, idx) => (
                            <tr key={slot.id || idx} className="hover:bg-white/[0.02]">
                              <td className="py-2 px-3 text-amber-300 font-bold">Slot #{idx + 1}</td>
                              <td className="py-2 px-3 text-slate-300">
                                {slot.x}, {slot.y} px
                              </td>
                              <td className="py-2 px-3 text-white">
                                {slot.width} × {slot.height} px
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-slate-400 text-xs">
                  Pilih salah satu template di samping untuk memeriksa susunan frame dan slot foto.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: KOLEKSI STIKER PNG & EMOJI                        */}
      {/* ======================================================== */}
      {studioTab === 'stickers' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <SmilePlus className="w-4 h-4 text-amber-400" />
                <span>Katalog Stiker & Aksesoris Foto ({adminStickers.length} Stiker)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload stiker PNG transparan (logo brand, event, aksesoris kacamata, pita) atau tambah karakter emoji untuk pelanggan.
              </p>
            </div>

            <button
              onClick={() => {
                setNewStickerForm({ name: '', category: 'Aksesoris', type: 'image', url: '', fileName: '' });
                setIsAddStickerModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 text-xs font-bold shadow-glow-primary active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Stiker Baru</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {adminStickers.map((s) => {
              const isImg = s.type === 'image';
              return (
                <div
                  key={s.id}
                  className="p-4 rounded-2xl glass-panel border border-white/10 hover:border-amber-400/40 flex flex-col items-center justify-between gap-3 text-center transition-all relative group"
                >
                  <span className="absolute top-2.5 left-2.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-white/10 text-slate-300">
                    {s.category}
                  </span>

                  <button
                    type="button"
                    onClick={() => setDeletingSticker(s)}
                    className="absolute top-2.5 right-2.5 text-slate-500 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Hapus Stiker"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="w-20 h-20 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-center p-2 mt-4">
                    {isImg ? (
                      <img src={s.url} alt={s.name} className="w-full h-full object-contain drop-shadow" />
                    ) : (
                      <span className="text-4xl">{s.url}</span>
                    )}
                  </div>

                  <div className="w-full">
                    <p className="text-xs font-bold text-white truncate">{s.name}</p>
                    <span className="text-[10px] text-amber-400/80 font-medium block mt-0.5">
                      {isImg ? 'PNG Transparan' : 'Emoji Karakter'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: RAGAM FONT TIPOGRAFI                              */}
      {/* ======================================================== */}
      {studioTab === 'fonts' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Type className="w-4 h-4 text-amber-400" />
                <span>Ragam Font Tipografi Studio ({adminFonts.length} Font)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Font tipografi yang tersedia di studio editor foto. Admin bebas menambahkan Google Font baru sesuai konsep booth.
              </p>
            </div>

            <button
              onClick={() => {
                setNewFontForm({ name: '', fontFamily: '', googleFont: '', previewText: 'Momen Indah Photobooth' });
                setIsAddFontModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 text-xs font-bold shadow-glow-primary active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Font Google Baru</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {adminFonts.map((f) => (
              <div
                key={f.id}
                className="p-5 rounded-2xl glass-panel border border-white/10 hover:border-amber-400/40 flex flex-col justify-between gap-4 transition-all relative group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">{f.name}</h4>
                    <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{f.fontFamily}</span>
                  </div>
                  {f.isCustom && (
                    <button
                      type="button"
                      onClick={() => setDeletingFont(f)}
                      className="text-slate-500 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Hapus Font"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Typography Live Preview Box */}
                <div className="p-4 rounded-xl bg-black/40 border border-white/5 text-center min-h-[72px] flex items-center justify-center">
                  <span
                    className="text-xl text-amber-300 block leading-tight truncate"
                    style={{ fontFamily: f.fontFamily }}
                  >
                    {f.previewText || 'Abadi Selamanya'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-white/5">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle className="w-3 h-3" />
                    <span>Aktif di Editor</span>
                  </span>
                  <span>{f.isCustom ? 'Font Kustom' : 'Font Bawaan'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: DESIGN & EDIT TEMPLATE FRAME STUDIO (SIMPLIFIED)  */}
      {/* ======================================================== */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        maxWidth="2xl"
        title={editingTemplateId ? 'Edit Tata Letak Slot Template' : 'Buat Template Frame Foto Baru'}
      >
        <form onSubmit={handleSaveImportedTemplate} className="space-y-4">
          {importError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{importError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* ========================================================= */}
            {/* KOLOM KIRI: VISUAL KANVAS BESAR DENGAN DRAG & RESIZE      */}
            {/* ========================================================= */}
            <div className="lg:col-span-6 flex flex-col items-center p-3 rounded-2xl bg-black/40 border border-white/10 space-y-3">
              {/* Toolbar Kontrol Tampilan Kanvas */}
              <div className="w-full flex items-center justify-between gap-2 pb-2 border-b border-white/10">
                {/* Mode Switcher */}
                <div className="flex items-center gap-1 p-0.5 rounded-xl bg-white/[0.05] border border-white/10">
                  <button
                    type="button"
                    onClick={() => setFrameLayerMode('edit')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                      frameLayerMode === 'edit'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Move className="w-3.5 h-3.5" />
                    <span>Mode Atur Slot</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFrameLayerMode('preview')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                      frameLayerMode === 'preview'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Pratinjau Cetak</span>
                  </button>
                </div>

                {/* Right controls: Snap Magnetik & Transparansi */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEnableMagneticSnap(!enableMagneticSnap)}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                      enableMagneticSnap
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-400/50 shadow-sm'
                        : 'bg-white/5 text-slate-400 border border-white/10 hover:text-white'
                    }`}
                    title="Nyalakan/matikan snap magnetik otomatis ke tengah kanvas dan slot lain"
                  >
                    <Magnet className={`w-3.5 h-3.5 ${enableMagneticSnap ? 'text-sky-400' : 'text-slate-400'}`} />
                    <span>Snap {enableMagneticSnap ? 'ON' : 'OFF'}</span>
                  </button>

                  {/* Transparansi Frame Slider / Pill */}
                  {importForm.frameUrl && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-300">
                      <span className="text-slate-400">Transparansi:</span>
                      {[0.5, 0.85, 1.0].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setFrameOpacity(val)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                            frameOpacity === val
                              ? 'bg-sky-400 text-slate-950'
                              : 'bg-white/5 text-slate-400 hover:text-white'
                          }`}
                        >
                          {Math.round(val * 100)}%
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Interactive Visual Canvas */}
              <div className="relative flex items-center justify-center p-2 rounded-xl bg-slate-950/80 border border-white/5 shadow-inner">
                <div
                  ref={previewBoxRef}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                  onPointerCancel={handleCanvasPointerUp}
                  style={{
                    width:
                      importForm.layoutType === 'STRIP_2x6' || modalCanvasW / modalCanvasH < 0.5
                        ? '160px'
                        : importForm.layoutType === '4R_PORTRAIT' || modalCanvasW < modalCanvasH
                        ? '285px'
                        : '420px',
                    height:
                      importForm.layoutType === '4R_PORTRAIT' || importForm.layoutType === 'STRIP_2x6' || modalCanvasW <= modalCanvasH
                        ? '428px'
                        : '280px',
                  }}
                  className="bg-slate-950 rounded-xl border-2 border-white/20 shadow-2xl relative overflow-hidden select-none touch-none"
                >
                  {/* Grid Lines Pembantu */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

                  {/* Smart Magnetic Snapping Glowing Guidelines */}
                  {activeGuides.x !== undefined && (
                    <div
                      style={{ left: `${(activeGuides.x / modalCanvasW) * 100}%` }}
                      className="absolute top-0 bottom-0 w-0.5 bg-sky-400 shadow-[0_0_8px_#38bdf8] pointer-events-none z-40"
                    >
                      <span className="absolute top-1 -translate-x-1/2 bg-sky-500 text-slate-950 font-mono text-[8px] font-black px-1 rounded shadow whitespace-nowrap">
                        X: {Math.round(activeGuides.x)}
                      </span>
                    </div>
                  )}
                  {activeGuides.y !== undefined && (
                    <div
                      style={{ top: `${(activeGuides.y / modalCanvasH) * 100}%` }}
                      className="absolute left-0 right-0 h-0.5 bg-sky-400 shadow-[0_0_8px_#38bdf8] pointer-events-none z-40"
                    >
                      <span className="absolute left-1 -translate-y-1/2 bg-sky-500 text-slate-950 font-mono text-[8px] font-black px-1 rounded shadow whitespace-nowrap">
                        Y: {Math.round(activeGuides.y)}
                      </span>
                    </div>
                  )}

                  {/* FRAME LAYER: Jika mode 'edit', Frame berada di BELAKANG (z-10) sehingga TIDAK MENUTUPI SLOT */}
                  {importForm.frameUrl && frameLayerMode === 'edit' && (
                    <img
                      src={importForm.frameUrl}
                      alt="Frame Background"
                      style={{ opacity: frameOpacity }}
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10 transition-opacity"
                    />
                  )}

                  {/* Empty Frame Guide Prompt */}
                  {!importForm.frameUrl && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 text-slate-500 pointer-events-none z-0">
                      <Upload className="w-8 h-8 mb-1.5 opacity-40 text-amber-400" />
                      <span className="text-xs font-semibold text-slate-400">Belum Ada Frame PNG</span>
                      <span className="text-[10px] text-slate-500">Pilih file PNG di panel samping</span>
                    </div>
                  )}

                  {/* SLOT LAYER: Slot foto interaktif (z-20 saat inaktif, z-30 saat aktif) */}
                  {importForm.slots.map((slot, index) => {
                    const leftPct = (slot.x / modalCanvasW) * 100;
                    const topPct = (slot.y / modalCanvasH) * 100;
                    const widthPct = (slot.width / modalCanvasW) * 100;
                    const heightPct = (slot.height / modalCanvasH) * 100;
                    const isActive = activeSlotIdx === index;

                    return (
                      <div
                        key={slot.id || index}
                        style={{
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                          width: `${widthPct}%`,
                          height: `${heightPct}%`,
                        }}
                        onPointerDown={(e) => handleSlotPointerDown(e, index, 'move')}
                        className={`absolute rounded-lg transition-all select-none touch-none flex flex-col items-center justify-between p-1.5 ${
                          frameLayerMode === 'preview'
                            ? 'bg-slate-700/80 border border-white/20 z-10'
                            : isActive
                            ? 'bg-sky-500/25 border-2 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.4)] z-30 cursor-move'
                            : 'bg-amber-400/15 border-2 border-dashed border-amber-400/70 hover:border-amber-300 z-20 cursor-move'
                        }`}
                      >
                        {/* Header Slot (Tag Ukuran & Status) */}
                        <div className="w-full flex items-center justify-between text-[9px] font-mono pointer-events-none">
                          <span
                            className={`px-1 rounded font-bold ${
                              isActive ? 'bg-sky-400 text-slate-950' : 'bg-slate-900/80 text-amber-300'
                            }`}
                          >
                            #{index + 1}
                          </span>
                          <span className="text-white/60 bg-slate-950/70 px-1 rounded">
                            {slot.width}×{slot.height}
                          </span>
                        </div>

                        {/* Center Icon Prompt */}
                        <div className="flex flex-col items-center justify-center pointer-events-none">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs ${
                              isActive ? 'bg-sky-400 text-slate-950 shadow-md' : 'bg-slate-900/80 text-amber-400'
                            }`}
                          >
                            <Move className="w-3.5 h-3.5 stroke-[2.5]" />
                          </div>
                          <span className="text-[9px] font-semibold text-white/80 mt-0.5">
                            {isActive ? 'Geser Bebas' : 'Pilih'}
                          </span>
                        </div>

                        {/* Bottom Bar / Resizer Handle */}
                        <div className="w-full flex items-center justify-end">
                          {isActive && frameLayerMode === 'edit' && (
                            <div
                              onPointerDown={(e) => handleSlotPointerDown(e, index, 'resize')}
                              className="w-5 h-5 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center justify-center cursor-nwse-resize shadow-md active:scale-95 transition-transform pointer-events-auto"
                              title="Tarik untuk perbesar / perkecil slot"
                            >
                              <Maximize2 className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* FRAME LAYER: Jika mode 'preview', Frame diletakkan di DEPAN (z-20) untuk pratinjau hasil cetak asli */}
                  {importForm.frameUrl && frameLayerMode === 'preview' && (
                    <img
                      src={importForm.frameUrl}
                      alt="Frame Foreground Preview"
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20"
                    />
                  )}
                </div>
              </div>

              {/* Panduan Cepat di Bawah Kanvas */}
              <div className="text-center text-[11px] text-slate-400 leading-relaxed bg-white/[0.03] p-2 rounded-xl border border-white/5 w-full">
                💡 <strong>Geser langsung:</strong> Sentuh & geser kotak slot di atas kanvas. <strong>Ubah ukuran:</strong> Tarik ikon panah di sudut kanan bawah slot aktif.
              </div>
            </div>

            {/* ========================================================= */}
            {/* KOLOM KANAN: PENGATURAN TEMPLATE & KONTROL CEPAT SLOT     */}
            {/* ========================================================= */}
            <div className="lg:col-span-6 space-y-4">
              {/* BAGIAN 1: INFO UTAMA & UPLOAD FILE */}
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">
                    Nama Template Frame
                  </label>
                  <input
                    type="text"
                    value={importForm.name}
                    onChange={(e) => setImportForm({ ...importForm, name: e.target.value })}
                    placeholder="Contoh: Frame Ulang Tahun Pink Gold"
                    className="w-full h-9 px-3 rounded-xl glass-input text-xs text-white"
                    required
                  />
                </div>

                {/* File Upload Dropzone */}
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">
                    File Frame PNG (Transparan)
                  </label>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/png,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePngFileSelect(file);
                    }}
                    className="hidden"
                  />

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      importForm.frameUrl
                        ? 'border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/15'
                        : 'border-white/20 hover:border-amber-500/50 hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 text-left truncate">
                      <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-400 flex items-center justify-center shrink-0">
                        {importForm.frameUrl ? <Check className="w-4 h-4 text-emerald-400 stroke-[3]" /> : <Upload className="w-4 h-4" />}
                      </div>
                      <div className="truncate">
                        <span className="text-xs font-bold text-white block truncate">
                          {importForm.fileName || 'Pilih File PNG Transparan'}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {importForm.frameUrl ? 'Klik untuk mengganti gambar' : 'Pastikan lubang foto transparan (PNG)'}
                        </span>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-white shrink-0">
                      Browse
                    </span>
                  </div>
                </div>

                {/* Format Kertas Standar */}
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">
                    Format Ukuran Kertas
                  </label>
                  <select
                    value={importForm.layoutType}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      let newW = 1200;
                      let newH = 1800;
                      if (val === 'STRIP_2x6') {
                        newW = 600;
                        newH = 1800;
                      } else if (val === 'CUSTOM') {
                        newW = importForm.width || 1200;
                        newH = importForm.height || 1800;
                      }
                      setImportForm({
                        ...importForm,
                        layoutType: val,
                        width: newW,
                        height: newH,
                      });
                    }}
                    className="w-full h-9 px-3 rounded-xl glass-input text-xs text-white bg-slate-900 border border-white/10"
                  >
                    <option value="4R_PORTRAIT">Standar Studio Portrait 10 × 15 cm (1200 × 1800 px)</option>
                    <option value="STRIP_2x6">Photo Strip 5 × 15 cm (600 × 1800 px)</option>
                    <option value="CUSTOM">Ukuran Kustom (Atur Lebar & Tinggi Bebas)</option>
                  </select>
                </div>
              </div>

              {/* BAGIAN 2: PRESET CEPAT JUMLAH FOTO (1-KLIK) */}
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">
                    Pilihan Preset Susunan Cepat:
                  </span>
                  <button
                    type="button"
                    onClick={handleAddSlot}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 text-xs font-bold border border-sky-500/30 cursor-pointer transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Slot</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'single-polaroid', label: '1 Foto', desc: 'Polaroid' },
                    { id: 'duo-vertical', label: '2 Foto', desc: 'Duo Vertikal' },
                    { id: 'trio-vertical', label: '3 Foto', desc: 'Trio Susun' },
                    { id: 'quad-grid', label: '4 Foto', desc: 'Grid 2×2' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleApplyPreset(p.id)}
                      className={`py-2 px-2 rounded-xl border text-center transition-all ${
                        selectedPresetId === p.id
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold shadow-sm ring-1 ring-amber-400/40'
                          : 'bg-white/[0.03] border-white/10 text-slate-300 hover:text-white hover:bg-white/[0.06]'
                      }`}
                    >
                      <span className="text-xs block font-bold">{p.label}</span>
                      <span className="text-[10px] text-slate-400 block">{p.desc}</span>
                    </button>
                  ))}
                </div>

                {/* Slot Selector Badges */}
                <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 custom-scrollbar">
                  <span className="text-[11px] text-slate-400 shrink-0 mr-1">Slot Aktif:</span>
                  {importForm.slots.map((s, idx) => (
                    <button
                      key={s.id || idx}
                      type="button"
                      onClick={() => setActiveSlotIdx(idx)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-all ${
                        activeSlotIdx === idx
                          ? 'bg-sky-400 text-slate-950 shadow-md ring-2 ring-white/50'
                          : 'bg-white/[0.05] text-slate-300 hover:text-white border border-white/10'
                      }`}
                    >
                      Slot #{idx + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* BAGIAN 3: PENGATUR POSISI & UKURAN KANVAS FOTO (INTUITIF & RAPI) */}
              {currentActiveSlot && (
                <div className="p-3.5 rounded-2xl bg-sky-950/30 border border-sky-400/30 space-y-3 shadow-md">
                  {/* Header Slot Terpilih & Indikator */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-extrabold text-sky-300">
                        Slot #{activeSlotIdx + 1}
                      </span>
                      <span className="text-[10px] text-sky-200/70 font-mono bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                        {currentActiveSlot.width}×{currentActiveSlot.height}px
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        (X: {currentActiveSlot.x}, Y: {currentActiveSlot.y})
                      </span>
                    </div>

                    {/* Pelurus & Perata Posisi Cepat (1-Klik) */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCenterBoth(activeSlotIdx)}
                        className="px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 text-[10px] font-bold flex items-center gap-1 border border-sky-500/30 active:scale-95 transition-all"
                        title="Taruh Slot Persis di Tengah-Tengah Kanvas (X & Y)"
                      >
                        <Crosshair className="w-3 h-3 text-amber-400" />
                        <span>Pusat Kanvas</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCenterHorizontal(activeSlotIdx)}
                        className="px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 text-[10px] font-bold flex items-center gap-1 border border-sky-500/30 active:scale-95 transition-all"
                        title="Luruskan Rata Tengah Kiri-Kanan"
                      >
                        <AlignCenter className="w-3 h-3" />
                        <span>Tengah Horizontal</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCenterVertical(activeSlotIdx)}
                        className="px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 text-[10px] font-bold flex items-center gap-1 border border-sky-500/30 active:scale-95 transition-all"
                        title="Luruskan Rata Tengah Atas-Bawah"
                      >
                        <Rows className="w-3 h-3" />
                        <span>Tengah Vertikal</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRotateSlot(activeSlotIdx)}
                        className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold flex items-center gap-1 border border-amber-500/30 active:scale-95 transition-all"
                        title="Putar 90 Derajat (Tukar Orientasi Potret <-> Lanskap)"
                      >
                        <RotateCw className="w-3 h-3" />
                        <span>Putar 90°</span>
                      </button>
                    </div>
                  </div>

                  {/* Kontrol Skala & Dimensi Custom */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-300">
                        Ubah Ukuran:
                      </span>
                      {importForm.slots.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleMatchAllToActive('both')}
                          className="px-2 py-0.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/30 text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                          title="Samakan Lebar & Tinggi semua slot foto persis dengan Slot ini"
                        >
                          <Maximize2 className="w-3 h-3 text-sky-300" />
                          <span>Samakan Ukuran Semua Slot</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleScaleSlot(activeSlotIdx, 1.1)}
                        className="py-1.5 px-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/30 text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                        <span>Perbesar +10%</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleScaleSlot(activeSlotIdx, 0.9)}
                        className="py-1.5 px-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                        <span>Perkecil -10%</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAdjustDimension(activeSlotIdx, 40, 0)}
                        className="py-1.5 px-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-[11px] font-semibold flex items-center justify-center gap-1 active:scale-95 transition-all"
                      >
                        <span>Lebar +</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAdjustDimension(activeSlotIdx, 0, 40)}
                        className="py-1.5 px-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-[11px] font-semibold flex items-center justify-center gap-1 active:scale-95 transition-all"
                      >
                        <span>Tinggi +</span>
                      </button>
                    </div>
                  </div>

                  {/* Kunci Rasio Aspek Foto Standar */}
                  <div className="space-y-1.5 pt-1 border-t border-white/10">
                    <span className="text-[11px] font-semibold text-slate-300 block">
                      Rasio Foto Kamera:
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSetAspectRatio(activeSlotIdx, 3, 2)}
                        className="py-1 px-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 text-[10px] font-bold text-center active:scale-95 transition-all"
                        title="Rasio Standar Kamera DSLR / Studio (3:2)"
                      >
                        3:2 Studio
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetAspectRatio(activeSlotIdx, 4, 3)}
                        className="py-1 px-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 text-[10px] font-bold text-center active:scale-95 transition-all"
                        title="Rasio Kamera Kompak / Webcam (4:3)"
                      >
                        4:3 Kompak
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetAspectRatio(activeSlotIdx, 1, 1)}
                        className="py-1 px-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 text-[10px] font-bold text-center active:scale-95 transition-all"
                        title="Rasio Persegi / Square (1:1)"
                      >
                        1:1 Persegi
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetAspectRatio(activeSlotIdx, 16, 9)}
                        className="py-1 px-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 text-[10px] font-bold text-center active:scale-95 transition-all"
                        title="Rasio Lebar Cinematic (16:9)"
                      >
                        16:9 Lebar
                      </button>
                    </div>
                  </div>

                  {/* Tombol Geser Posisi Halus (Nudge D-Pad) & Tindakan Slot */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-semibold text-slate-300 mr-1">
                        Geser Halus:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleNudgeSlot(activeSlotIdx, 0, -25)}
                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 text-slate-200 flex items-center justify-center text-xs font-bold active:scale-95"
                        title="Geser ke Atas (25px)"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNudgeSlot(activeSlotIdx, 0, 25)}
                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 text-slate-200 flex items-center justify-center text-xs font-bold active:scale-95"
                        title="Geser ke Bawah (25px)"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNudgeSlot(activeSlotIdx, -25, 0)}
                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 text-slate-200 flex items-center justify-center text-xs font-bold active:scale-95"
                        title="Geser ke Kiri (25px)"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNudgeSlot(activeSlotIdx, 25, 0)}
                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 text-slate-200 flex items-center justify-center text-xs font-bold active:scale-95"
                        title="Geser ke Kanan (25px)"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      {importForm.slots.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleReorderSlot(activeSlotIdx, 'up')}
                            disabled={activeSlotIdx === 0}
                            className="px-1.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 text-[10px] font-bold"
                            title="Tukar urutan ke atas"
                          >
                            ▲ Urutan
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReorderSlot(activeSlotIdx, 'down')}
                            disabled={activeSlotIdx === importForm.slots.length - 1}
                            className="px-1.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 text-[10px] font-bold"
                            title="Tukar urutan ke bawah"
                          >
                            ▼ Urutan
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDuplicateSlot(activeSlotIdx)}
                        className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                        title="Duplikasi Slot Ini"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Duplikasi</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSlot(activeSlotIdx)}
                        className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px] font-bold flex items-center gap-1 border border-rose-500/30 active:scale-95 transition-all cursor-pointer"
                        title="Hapus Slot Ini"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>

                  {/* Accordion Angka Presisi Manual (Opsional) */}
                  <div className="pt-1 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setShowCoordinatesManual(!showCoordinatesManual)}
                      className="text-[10px] font-bold text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Sliders className="w-3 h-3" />
                      <span>{showCoordinatesManual ? 'Sembunyikan Koordinat Manual' : 'Buka Koordinat Angka Presisi (X, Y, W, H)'}</span>
                    </button>

                    {showCoordinatesManual && (
                      <div className="grid grid-cols-4 gap-2 font-mono text-xs mt-2 p-2 rounded-xl bg-black/40 border border-white/10">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">X (px):</label>
                          <input
                            type="number"
                            min="0"
                            value={currentActiveSlot.x}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                              setImportForm((prev) => ({
                                ...prev,
                                slots: prev.slots.map((s, i) => (i === activeSlotIdx ? { ...s, x: val } : s)),
                              }));
                            }}
                            className="w-full h-7 px-2 rounded-lg glass-input text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">Y (px):</label>
                          <input
                            type="number"
                            min="0"
                            value={currentActiveSlot.y}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                              setImportForm((prev) => ({
                                ...prev,
                                slots: prev.slots.map((s, i) => (i === activeSlotIdx ? { ...s, y: val } : s)),
                              }));
                            }}
                            className="w-full h-7 px-2 rounded-lg glass-input text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">Lebar (W):</label>
                          <input
                            type="number"
                            min="50"
                            value={currentActiveSlot.width}
                            onChange={(e) => {
                              const val = Math.max(50, parseInt(e.target.value, 10) || 50);
                              setImportForm((prev) => ({
                                ...prev,
                                slots: prev.slots.map((s, i) => (i === activeSlotIdx ? { ...s, width: val } : s)),
                              }));
                            }}
                            className="w-full h-7 px-2 rounded-lg glass-input text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">Tinggi (H):</label>
                          <input
                            type="number"
                            min="50"
                            value={currentActiveSlot.height}
                            onChange={(e) => {
                              const val = Math.max(50, parseInt(e.target.value, 10) || 50);
                              setImportForm((prev) => ({
                                ...prev,
                                slots: prev.slots.map((s, i) => (i === activeSlotIdx ? { ...s, height: val } : s)),
                              }));
                            }}
                            className="w-full h-7 px-2 rounded-lg glass-input text-xs text-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer Buttons */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isSavingTemplate}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 text-xs font-black shadow-glow-primary active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSavingTemplate && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{editingTemplateId ? 'Simpan Perubahan Template' : 'Simpan & Aktifkan Template'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL: TAMBAH STIKER PNG / EMOJI                         */}
      {/* ======================================================== */}
      <Modal
        isOpen={isAddStickerModalOpen}
        onClose={() => setIsAddStickerModalOpen(false)}
        maxWidth="md"
        title="Tambah Stiker Baru ke Studio"
      >
        <form onSubmit={handleSaveSticker} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Tipe Stiker:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNewStickerForm({ ...newStickerForm, type: 'image', url: '' })}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  newStickerForm.type === 'image'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                    : 'glass-panel text-slate-300 border-white/10'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Upload Stiker PNG</span>
              </button>
              <button
                type="button"
                onClick={() => setNewStickerForm({ ...newStickerForm, type: 'emoji', url: '✨' })}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  newStickerForm.type === 'emoji'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                    : 'glass-panel text-slate-300 border-white/10'
                }`}
              >
                <SmilePlus className="w-3.5 h-3.5" />
                <span>Karakter Emoji</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Nama Stiker:</label>
            <input
              type="text"
              value={newStickerForm.name}
              onChange={(e) => setNewStickerForm({ ...newStickerForm, name: e.target.value })}
              placeholder="Contoh: Kacamata Party / Logo Cafe"
              className="w-full h-10 px-3 rounded-xl glass-input text-xs text-white"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Kategori Stiker:</label>
            <select
              value={newStickerForm.category}
              onChange={(e) => setNewStickerForm({ ...newStickerForm, category: e.target.value })}
              className="w-full h-10 px-3 rounded-xl glass-input text-xs text-white bg-slate-900 border border-white/10"
            >
              <option value="Aksesoris">Aksesoris (Topi, Kacamata, Pita)</option>
              <option value="Branding">Branding & Logo Event</option>
              <option value="Event">Event & Perayaan</option>
              <option value="Dekorasi">Dekorasi & Bunga</option>
              <option value="Emoji">Emoji Umum</option>
            </select>
          </div>

          {newStickerForm.type === 'image' ? (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Upload File PNG Transparan:</label>
              <input
                type="file"
                ref={stickerFileInputRef}
                accept="image/png,.png"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleStickerFileSelect(file);
                }}
                className="hidden"
              />
              <div
                onClick={() => stickerFileInputRef.current?.click()}
                className="border-2 border-dashed border-white/20 hover:border-amber-400/50 p-4 rounded-xl text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2"
              >
                {newStickerForm.url ? (
                  <div className="flex items-center gap-3">
                    <img src={newStickerForm.url} alt="Sticker Preview" className="w-12 h-12 object-contain" />
                    <span className="text-xs text-emerald-400 font-bold">{newStickerForm.fileName || 'PNG Terpasang'}</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-amber-400" />
                    <span className="text-xs font-bold text-white">Pilih File PNG Transparan</span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Pilih / Ketik Emoji:</label>
              <input
                type="text"
                value={newStickerForm.url}
                onChange={(e) => setNewStickerForm({ ...newStickerForm, url: e.target.value })}
                placeholder="Contoh: ✨ atau 🎉 atau 👑"
                className="w-full h-10 px-3 rounded-xl glass-input text-lg text-white"
                required
              />
            </div>
          )}

          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsAddStickerModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 text-xs font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSavingSticker || !newStickerForm.url}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-glow-primary active:scale-95 disabled:opacity-50"
            >
              {isSavingSticker ? 'Menyimpan...' : 'Simpan Stiker'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL: TAMBAH FONT GOOGLE TIPOGRAFI                      */}
      {/* ======================================================== */}
      <Modal
        isOpen={isAddFontModalOpen}
        onClose={() => setIsAddFontModalOpen(false)}
        maxWidth="md"
        title="Tambah Font Google Tipografi Baru"
      >
        <form onSubmit={handleSaveFont} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Nama Tampilan Font:</label>
            <input
              type="text"
              value={newFontForm.name}
              onChange={(e) => {
                const val = e.target.value;
                setNewFontForm({
                  ...newFontForm,
                  name: val,
                  fontFamily: newFontForm.fontFamily || val,
                  googleFont: newFontForm.googleFont || val,
                });
              }}
              placeholder="Contoh: Lobster Retro"
              className="w-full h-10 px-3 rounded-xl glass-input text-xs text-white"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Nama Google Font (Exact Name):
            </label>
            <input
              type="text"
              value={newFontForm.fontFamily}
              onChange={(e) => {
                const val = e.target.value;
                setNewFontForm({
                  ...newFontForm,
                  fontFamily: val,
                  googleFont: val,
                });
                // Dynamically test load Google Font stylesheet
                if (val.trim()) {
                  const cleanName = val.split(',')[0].replace(/['"]/g, '').trim();
                  const id = `gfont-test-${cleanName.toLowerCase().replace(/\s+/g, '-')}`;
                  if (!document.getElementById(id)) {
                    const link = document.createElement('link');
                    link.id = id;
                    link.rel = 'stylesheet';
                    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(cleanName)}:wght@400;700&display=swap`;
                    document.head.appendChild(link);
                  }
                }
              }}
              placeholder="Contoh: Lobster atau Bebas Neue atau Sacramento"
              className="w-full h-10 px-3 rounded-xl glass-input text-xs text-white font-mono"
              required
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Dapat dicek di <a href="https://fonts.google.com" target="_blank" rel="noreferrer" className="text-amber-400 underline">fonts.google.com</a>
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Teks Pratinjau:</label>
            <input
              type="text"
              value={newFontForm.previewText}
              onChange={(e) => setNewFontForm({ ...newFontForm, previewText: e.target.value })}
              placeholder="Ketik teks uji coba..."
              className="w-full h-10 px-3 rounded-xl glass-input text-xs text-white"
            />
          </div>

          {/* Live Preview of the Font */}
          {newFontForm.fontFamily && (
            <div className="p-4 rounded-xl bg-black/40 border border-white/10 text-center space-y-1">
              <span className="text-[10px] text-slate-400 block font-mono">Pratinjau Langsung:</span>
              <span
                className="text-2xl text-amber-300 block truncate"
                style={{ fontFamily: newFontForm.fontFamily }}
              >
                {newFontForm.previewText || 'Momen Indah Photobooth'}
              </span>
            </div>
          )}

          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsAddFontModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 text-xs font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSavingFont || !newFontForm.fontFamily}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-glow-primary active:scale-95 disabled:opacity-50"
            >
              {isSavingFont ? 'Menyimpan...' : 'Simpan & Aktifkan Font'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        isOpen={Boolean(deletingTemplate)}
        title="Hapus Template Frame Ini?"
        message={`Template "${deletingTemplate?.name}" akan dihapus permanen dari sistem. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus Template"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={handleDeleteTemplate}
        onCancel={() => setDeletingTemplate(null)}
      />

      <ConfirmationDialog
        isOpen={Boolean(deletingSticker)}
        title="Hapus Stiker Ini?"
        message={`Stiker "${deletingSticker?.name}" akan dihapus dari koleksi editor studio.`}
        confirmLabel="Hapus Stiker"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={handleDeleteSticker}
        onCancel={() => setDeletingSticker(null)}
      />

      <ConfirmationDialog
        isOpen={Boolean(deletingFont)}
        title="Hapus Font Ini?"
        message={`Font "${deletingFont?.name}" akan dihapus dari pilihan editor studio.`}
        confirmLabel="Hapus Font"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={handleDeleteFont}
        onCancel={() => setDeletingFont(null)}
      />
    </div>
  );
};
