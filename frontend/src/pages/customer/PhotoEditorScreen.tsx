import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Layout,
  Wand2,
  SmilePlus,
  Type,
  Plus,
  Trash2,
  Crop,
  Layers,
  ZoomIn,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Check,
  Maximize2,
  Images,
  X,
  Copy,
  AlertTriangle,
  CheckCircle2,
  ArrowLeftRight,
} from 'lucide-react';
import { TemplateItem } from '../../types/template';
import { FilterPreset, PhotoAdjustment, SlotAdjustment, StickerElement, TextElement } from '../../types/editor';
import { FontItem, StickerItem } from '../../types/assets';
import { photoboothApi } from '../../services/photoboothApi';
import { CanvasEditor } from '../../components/editor/CanvasEditor';
import { TemplateSelector } from '../../components/editor/TemplateSelector';
import { StickerPicker } from '../../components/editor/StickerPicker';
import { EditorToolbar } from '../../components/editor/EditorToolbar';
import { Layout4RPreview } from '../../components/customer/Layout4RPreview';
import { Button } from '../../components/common/Button';
import { useToast } from '../../components/common/Toast';
import { Modal } from '../../components/common/Modal';
import { ConfirmationDialog } from '../../components/common/ConfirmationDialog';
import { SessionTimerBadge } from '../../components/customer/SessionTimerBadge';
import { playButtonSound } from '../../services/soundEffects';
import { PhotoEngine } from '../../photo-engine';

export interface SavedFrameDesignItem {
  id: string;
  title: string;
  layoutUrl: string;
  templateName?: string;
  slotsCount?: number;
}

export interface FrameDesignState {
  id: string;
  title: string;
  template: TemplateItem;
  slotPhotoMap: Record<number, string>;
  slotAdjustments: Record<number, SlotAdjustment>;
  activeFilter: FilterPreset;
  adjustments: PhotoAdjustment;
  stickers: StickerElement[];
  texts: TextElement[];
  renderedDataUrl: string;
}

export interface PhotoEditorScreenProps {
  selectedPhotoUrls?: string[];
  capturedPhotoUrls?: string[];
  initialTemplateId?: string;
  sessionSecondsLeft?: number;
  onBack: () => void;
  onProceed: (
    allDesigns: SavedFrameDesignItem[],
    finalPhotos?: string[]
  ) => void;
}

interface EditorHistorySnapshot {
  filter: FilterPreset;
  adjustments: PhotoAdjustment;
  slotAdjustments: Record<number, SlotAdjustment>;
  stickers: StickerElement[];
  texts: TextElement[];
  templateId: string;
}

export interface FontOptionItem {
  id: string;
  label: string;
  preview: string;
  isCustom?: boolean;
}

const FONT_OPTIONS: FontOptionItem[] = [
  { id: 'Plus Jakarta Sans', label: 'Modern Sans', preview: 'Modern' },
  { id: 'Playfair Display', label: 'Luxury Serif', preview: 'Luxury' },
  { id: 'Lobster', label: 'Retro Party', preview: 'Party ✨' },
  { id: 'Permanent Marker', label: 'Street Marker', preview: 'MARKER!' },
  { id: 'Pacifico', label: 'Beach Script', preview: 'Pacific' },
  { id: 'Dancing Script', label: 'Romantic Script', preview: 'Romance ❤️' },
  { id: 'Righteous', label: 'Retro Arcade', preview: 'ARCADE' },
  { id: 'Bebas Neue', label: 'Bold Studio', preview: 'STUDIO' },
  { id: 'Fredoka', label: 'Cute Bubble', preview: 'Bubble' },
  { id: 'Abril Fatface', label: 'Vogue Fashion', preview: 'Fashion' },
  { id: 'Comfortaa', label: 'Aesthetic Soft', preview: 'aesthetic' },
  { id: 'Caveat', label: 'Handwritten', preview: 'Catatan' },
  { id: 'JetBrains Mono', label: 'Tech Code', preview: 'TIMESTAMP' },
];

const COLOR_OPTIONS = [
  { hex: '#F59E0B', label: 'Gold', bg: 'bg-amber-400' },
  { hex: '#FFFFFF', label: 'Putih', bg: 'bg-white' },
  { hex: '#EC4899', label: 'Pink', bg: 'bg-pink-500' },
  { hex: '#38BDF8', label: 'Cyan', bg: 'bg-sky-400' },
  { hex: '#10B981', label: 'Mint', bg: 'bg-emerald-400' },
  { hex: '#A855F7', label: 'Ungu', bg: 'bg-purple-500' },
  { hex: '#F43F5E', label: 'Merah', bg: 'bg-rose-500' },
  { hex: '#0F172A', label: 'Gelap', bg: 'bg-slate-900 border border-white/40' },
];

const STUDIO_FILTERS: { id: FilterPreset; label: string; previewColor: string; desc: string }[] = [
  { id: 'normal', label: 'Original', previewColor: 'from-slate-700 to-slate-800', desc: 'Warna Asli Natural' },
  { id: 'glamour', label: 'Glamour Glow', previewColor: 'from-rose-900 to-pink-500', desc: 'Glowing Estetik' },
  { id: 'bw', label: 'Classic B & W', previewColor: 'from-neutral-900 to-neutral-400', desc: 'Hitam Putih Sinematik' },
  { id: 'warm', label: 'Warm Sun', previewColor: 'from-orange-800 to-amber-500', desc: 'Hangat Cerah' },
  { id: 'cool', label: 'Cool Blue', previewColor: 'from-blue-900 to-cyan-500', desc: 'Dingin Modern' },
  { id: 'sepia', label: 'Vintage Sepia', previewColor: 'from-amber-900 to-amber-600', desc: 'Nostalgia Retro' },
];

export const PhotoEditorScreen: React.FC<PhotoEditorScreenProps> = ({
  selectedPhotoUrls,
  capturedPhotoUrls,
  initialTemplateId = 'tpl-classic-4r-2',
  sessionSecondsLeft = 180,
  onBack,
  onProceed,
}) => {
  const { showToast } = useToast();

  // All captured photos from camera session (up to 10 photos)
  const allPhotos =
    capturedPhotoUrls && capturedPhotoUrls.length > 0
      ? capturedPhotoUrls
      : selectedPhotoUrls && selectedPhotoUrls.length > 0
        ? selectedPhotoUrls
        : [];

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);

  // Mapping of template slot index -> photoUrl
  const [slotPhotoMap, setSlotPhotoMap] = useState<Record<number, string>>({});
  const [renderedLayoutUrl, setRenderedLayoutUrl] = useState<string>('');

  // Multi-frame designs state (Unlimited frame designs during session)
  const [designs, setDesigns] = useState<FrameDesignState[]>([]);
  const [activeDesignId, setActiveDesignId] = useState<string>('design-1');
  const [isTimeoutAlertOpen, setIsTimeoutAlertOpen] = useState(false);
  const [timeoutCountdown, setTimeoutCountdown] = useState(5);
  const timeoutHandledRef = useRef(false);

  // Unconditional memoization of slot photo URLs at top level
  const renderedPhotoUrls = useMemo(() => {
    if (!selectedTemplate) return [];
    return selectedTemplate.slots.map((_, idx) => slotPhotoMap[idx] || '');
  }, [selectedTemplate, slotPhotoMap]);

  // Studio Category Tab ('frame' | 'filter' | 'sticker' | 'text')
  const [activeTab, setActiveTab] = useState<'frame' | 'filter' | 'sticker' | 'text'>('frame');

  // Active Selected Slot (0, 1, 2... or null)
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(0);

  // Per-slot adjustments (crop, zoom, pan, rotation, filter, etc.)
  const [slotAdjustments, setSlotAdjustments] = useState<Record<number, SlotAdjustment>>({});

  // Filter application scope: 'selected' vs 'all'
  const [filterScope, setFilterScope] = useState<'selected' | 'all'>('selected');

  // Global Editor States
  const [activeFilter, setActiveFilter] = useState<FilterPreset>('normal');
  const [adjustments, setAdjustments] = useState<PhotoAdjustment>({
    brightness: 0,
    contrast: 0,
    rotation: 0,
  });
  const [stickers, setStickers] = useState<StickerElement[]>([]);
  const [texts, setTexts] = useState<TextElement[]>([]);
  const [customTextInput, setCustomTextInput] = useState('');

  // Typography & Active Selection States
  const [selectedFont, setSelectedFont] = useState<string>('Plus Jakarta Sans');
  const [selectedColor, setSelectedColor] = useState<string>('#F59E0B');
  const [selectedElement, setSelectedElement] = useState<{
    type: 'sticker' | 'text';
    id: string;
  } | null>(null);

  // Active slot index for touchscreen photo picker dialog
  const [pickingForSlot, setPickingForSlot] = useState<number | null>(null);

  // Dynamic Studio Assets from Admin Backend
  const [availableFonts, setAvailableFonts] = useState<FontItem[]>([]);
  const [availableStickers, setAvailableStickers] = useState<StickerItem[]>([]);

  // Print Preview Modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Confirmation Dialog States
  const [isConfirmPrintOpen, setIsConfirmPrintOpen] = useState(false);
  const [isConfirmCancelOpen, setIsConfirmCancelOpen] = useState(false);

  // Undo / Redo History Stacks
  const [history, setHistory] = useState<EditorHistorySnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Load dynamic typography fonts and stickers
  useEffect(() => {
    let isMounted = true;
    const loadStudioAssets = async () => {
      try {
        const [fontsRes, stickersRes] = await Promise.all([
          photoboothApi.getPublicFonts(),
          photoboothApi.getPublicStickers(),
        ]);
        if (!isMounted) return;
        if (fontsRes.success && fontsRes.data && fontsRes.data.length > 0) {
          setAvailableFonts(fontsRes.data);
          fontsRes.data.forEach((f) => {
            const fontName = f.googleFont || f.fontFamily;
            if (fontName) {
              const fontSlug = fontName.replace(/\s+/g, '-').toLowerCase();
              const linkId = `gfont-link-${fontSlug}`;
              if (!document.getElementById(linkId)) {
                const link = document.createElement('link');
                link.id = linkId;
                link.rel = 'stylesheet';
                link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;700&display=swap`;
                document.head.appendChild(link);
              }
            }
          });
        }
        if (stickersRes.success && stickersRes.data && stickersRes.data.length > 0) {
          setAvailableStickers(stickersRes.data);
        }
        // Pre-warm / decode foto sesi pelanggan ke memori PhotoEngine
        if (allPhotos.length > 0) {
          PhotoEngine.preloadSession(allPhotos);
        }
      } catch (err) {
        console.warn('Failed to load dynamic studio assets:', err);
      }
    };
    loadStudioAssets();
    return () => {
      isMounted = false;
    };
  }, []);

  // Computed studio fonts (merged default + admin custom fonts)
  const displayFonts = useMemo(() => {
    if (availableFonts.length > 0) {
      return availableFonts.map((f) => ({
        id: f.fontFamily,
        label: f.name,
        preview: f.previewText || f.name,
        isCustom: f.isCustom,
      }));
    }
    return FONT_OPTIONS;
  }, [availableFonts]);

  // Slot photo assignment handlers
  const handleAssignPhotoToSlot = (slotIndex: number, photoUrl: string) => {
    playButtonSound('secondary');
    const nextMap = { ...slotPhotoMap, [slotIndex]: photoUrl };
    setSlotPhotoMap(nextMap);

    // Synchronize active design immediately
    setDesigns((prev) =>
      prev.map((d) => (d.id === activeDesignId ? { ...d, slotPhotoMap: nextMap } : d))
    );

    // Auto-advance to the next empty slot so sequential taps fill all slots effortlessly
    if (selectedTemplate) {
      const nextEmpty = selectedTemplate.slots.findIndex((_, idx) => idx !== slotIndex && !nextMap[idx]);
      if (nextEmpty !== -1) {
        setSelectedSlotIndex(nextEmpty);
      } else {
        setSelectedSlotIndex((slotIndex + 1) % selectedTemplate.slots.length);
      }
    } else {
      setSelectedSlotIndex(slotIndex);
    }

    showToast({
      type: 'success',
      title: 'Foto Terpasang!',
      message: `Foto berhasil dimasukkan ke Slot #${slotIndex + 1}.`,
    });
  };

  const handleClearSlot = (slotIndex: number) => {
    playButtonSound('delete');
    const next = { ...slotPhotoMap };
    delete next[slotIndex];
    setSlotPhotoMap(next);
    setDesigns((prev) =>
      prev.map((d) => (d.id === activeDesignId ? { ...d, slotPhotoMap: next } : d))
    );
    showToast({
      type: 'info',
      title: 'Slot Dikosongkan',
      message: `Foto di Slot #${slotIndex + 1} dilepas.`,
    });
  };

  const handleSwapSlots = (slotA: number, slotB: number) => {
    if (slotA === slotB) return;
    playButtonSound('secondary');
    const next = { ...slotPhotoMap };
    const photoA = next[slotA];
    const photoB = next[slotB];
    if (photoB) next[slotA] = photoB; else delete next[slotA];
    if (photoA) next[slotB] = photoA; else delete next[slotB];
    setSlotPhotoMap(next);
    setDesigns((prev) =>
      prev.map((d) => (d.id === activeDesignId ? { ...d, slotPhotoMap: next } : d))
    );
    showToast({
      type: 'info',
      title: 'Posisi Foto Ditukar!',
      message: `Foto Slot #${slotA + 1} dan Slot #${slotB + 1} berhasil ditukar posisinya.`,
    });
  };

  const handleAutoFillSlots = () => {
    if (!selectedTemplate) return;
    playButtonSound('secondary');
    const nextMap: Record<number, string> = {};
    selectedTemplate.slots.forEach((_, idx) => {
      if (allPhotos[idx]) {
        nextMap[idx] = allPhotos[idx];
      }
    });
    setSlotPhotoMap(nextMap);
    setDesigns((prev) =>
      prev.map((d) => (d.id === activeDesignId ? { ...d, slotPhotoMap: nextMap } : d))
    );
    showToast({
      type: 'success',
      title: 'Auto Isi Selesai',
      message: 'Foto sesi telah dipasangkan ke frame secara berurutan.',
    });
  };

  const handleClearAllSlots = () => {
    playButtonSound('delete');
    setSlotPhotoMap({});
    setDesigns((prev) =>
      prev.map((d) => (d.id === activeDesignId ? { ...d, slotPhotoMap: {} } : d))
    );
    showToast({
      type: 'info',
      title: 'Frame Dikosongkan',
      message: 'Semua slot frame kini kosong. Sentuh foto di kiri untuk memasang.',
    });
  };

  const handleSelectTemplate = (newTemplate: TemplateItem) => {
    playButtonSound('secondary');
    setSelectedTemplate(newTemplate);

    // Retain existing assigned photos in slots, and auto-fill any extra slots with allPhotos
    const nextMap: Record<number, string> = {};
    newTemplate.slots.forEach((_, idx) => {
      if (slotPhotoMap[idx]) {
        nextMap[idx] = slotPhotoMap[idx];
      } else if (allPhotos[idx]) {
        nextMap[idx] = allPhotos[idx];
      }
    });

    setSlotPhotoMap(nextMap);
    setSelectedSlotIndex(0);

    setDesigns((prev) =>
      prev.map((d) =>
        d.id === activeDesignId ? { ...d, template: newTemplate, slotPhotoMap: nextMap } : d
      )
    );
    pushHistory({ templateId: newTemplate.id });
    showToast({
      type: 'info',
      title: 'Bingkai Dipilih!',
      message: `Menggunakan layout bingkai "${newTemplate.name}".`,
    });
  };

  // Load templates from API
  useEffect(() => {
    const loadTemplates = async () => {
      const res = await photoboothApi.getTemplates();
      if (res.success && res.data.length > 0) {
        setTemplates(res.data);
        const match = res.data.find((t) => t.id === initialTemplateId) || res.data[0];
        setSelectedTemplate(match);

        // Auto-fill frame slots with customer's captured photos by default so they immediately see their photos
        const autoMap: Record<number, string> = {};
        match.slots.forEach((_, idx) => {
          if (allPhotos[idx]) {
            autoMap[idx] = allPhotos[idx];
          }
        });
        setSlotPhotoMap(autoMap);

        const firstDesign: FrameDesignState = {
          id: `design-${Date.now()}-1`,
          title: 'Desain Frame #1',
          template: match,
          slotPhotoMap: autoMap,
          slotAdjustments: {},
          activeFilter: 'normal',
          adjustments: { brightness: 0, contrast: 0, rotation: 0 },
          stickers: [],
          texts: [],
          renderedDataUrl: '',
        };
        setDesigns([firstDesign]);
        setActiveDesignId(firstDesign.id);

        const initialSnap: EditorHistorySnapshot = {
          filter: 'normal',
          adjustments: { brightness: 0, contrast: 0, rotation: 0 },
          slotAdjustments: {},
          stickers: [],
          texts: [],
          templateId: match.id,
        };
        setHistory([initialSnap]);
        setHistoryIndex(0);
      }
    };

    loadTemplates();
  }, [initialTemplateId]);

  // Record history snapshot
  const pushHistory = (snapshot: Partial<EditorHistorySnapshot>) => {
    if (!selectedTemplate) return;
    const currentSnap: EditorHistorySnapshot = {
      filter: snapshot.filter ?? activeFilter,
      adjustments: snapshot.adjustments ?? adjustments,
      slotAdjustments: snapshot.slotAdjustments ?? slotAdjustments,
      stickers: snapshot.stickers ?? stickers,
      texts: snapshot.texts ?? texts,
      templateId: snapshot.templateId ?? selectedTemplate.id,
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(currentSnap);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setActiveFilter(prev.filter);
      setAdjustments(prev.adjustments);
      setSlotAdjustments(prev.slotAdjustments || {});
      setStickers(prev.stickers);
      setTexts(prev.texts);
      const match = templates.find((t) => t.id === prev.templateId);
      if (match) setSelectedTemplate(match);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setActiveFilter(next.filter);
      setAdjustments(next.adjustments);
      setSlotAdjustments(next.slotAdjustments || {});
      setStickers(next.stickers);
      setTexts(next.texts);
      const match = templates.find((t) => t.id === next.templateId);
      if (match) setSelectedTemplate(match);
      setHistoryIndex(historyIndex + 1);
    }
  };

  const handleReset = () => {
    const resetAdj = { brightness: 0, contrast: 0, rotation: 0 };
    setActiveFilter('normal');
    setAdjustments(resetAdj);
    setSlotAdjustments({});
    setStickers([]);
    setTexts([]);
    setSelectedElement(null);
    setSelectedSlotIndex(0);
    // Reset slot photos to empty
    setSlotPhotoMap({});
    pushHistory({
      filter: 'normal',
      adjustments: resetAdj,
      slotAdjustments: {},
      stickers: [],
      texts: [],
    });
    showToast({
      type: 'info',
      title: 'Editor Direset',
      message: 'Semua filter, crop, stiker, dan teks telah dikembalikan ke awal.',
    });
  };

  // Slot Adjustment Handlers (Zoom, Pan/Crop, Rotate)
  const currentSlotAdj: SlotAdjustment =
    selectedSlotIndex !== null
      ? slotAdjustments[selectedSlotIndex] || {
        zoom: 1.0,
        panX: 0,
        panY: 0,
        rotation: 0,
        brightness: 0,
        contrast: 0,
      }
      : {
        zoom: 1.0,
        panX: 0,
        panY: 0,
        rotation: 0,
        brightness: 0,
        contrast: 0,
      };

  const handleUpdateSlotAdj = useCallback((index: number, updates: Partial<SlotAdjustment>) => {
    setSlotAdjustments((prev) => {
      const current = prev[index] || {
        zoom: 1.0,
        panX: 0,
        panY: 0,
        rotation: 0,
        brightness: 0,
        contrast: 0,
      };
      return {
        ...prev,
        [index]: { ...current, ...updates },
      };
    });
  }, []);

  const handleResetSlotCrop = (index: number) => {
    const current = slotAdjustments[index] || {
      zoom: 1.0,
      panX: 0,
      panY: 0,
      rotation: 0,
      brightness: 0,
      contrast: 0,
    };
    const updated = {
      ...slotAdjustments,
      [index]: { ...current, zoom: 1.0, panX: 0, panY: 0, rotation: 0 },
    };
    setSlotAdjustments(updated);
    pushHistory({ slotAdjustments: updated });
    showToast({
      type: 'info',
      title: 'Framing Direset',
      message: `Crop dan posisi Foto #${index + 1} dikembalikan ke default.`,
    });
  };

  const handlePanSlot = (index: number, deltaX: number, deltaY: number) => {
    const cur = slotAdjustments[index] || {
      zoom: 1.0,
      panX: 0,
      panY: 0,
      rotation: 0,
      brightness: 0,
      contrast: 0,
    };
    const updatedPanX = cur.panX + deltaX;
    const updatedPanY = cur.panY + deltaY;
    handleUpdateSlotAdj(index, { panX: updatedPanX, panY: updatedPanY });
  };

  const handleRotateSlot = (index: number) => {
    const cur = slotAdjustments[index] || {
      zoom: 1.0,
      panX: 0,
      panY: 0,
      rotation: 0,
      brightness: 0,
      contrast: 0,
    };
    const nextRot = (cur.rotation + 90) % 360;
    const updated = {
      ...slotAdjustments,
      [index]: { ...cur, rotation: nextRot },
    };
    setSlotAdjustments(updated);
    pushHistory({ slotAdjustments: updated });
  };

  // Filter Application (Selected slot vs All slots)
  const handleApplyFilter = (f: FilterPreset) => {
    if (filterScope === 'selected' && selectedSlotIndex !== null) {
      const cur = slotAdjustments[selectedSlotIndex] || {
        zoom: 1.0,
        panX: 0,
        panY: 0,
        rotation: 0,
        brightness: 0,
        contrast: 0,
      };
      const updated = {
        ...slotAdjustments,
        [selectedSlotIndex]: { ...cur, filter: f },
      };
      setSlotAdjustments(updated);
      pushHistory({ slotAdjustments: updated });
      showToast({
        type: 'info',
        title: 'Filter Diterapkan!',
        message: `Filter ${f.toUpperCase()} diterapkan khusus pada Foto #${selectedSlotIndex + 1}.`,
      });
    } else {
      setActiveFilter(f);
      if (selectedTemplate) {
        const updated: Record<number, SlotAdjustment> = {};
        selectedTemplate.slots.forEach((_, idx) => {
          const cur = slotAdjustments[idx] || {
            zoom: 1.0,
            panX: 0,
            panY: 0,
            rotation: 0,
            brightness: 0,
            contrast: 0,
          };
          updated[idx] = { ...cur, filter: f };
        });
        setSlotAdjustments(updated);
        pushHistory({ filter: f, slotAdjustments: updated });
      } else {
        pushHistory({ filter: f });
      }
      showToast({
        type: 'info',
        title: 'Filter Semua Foto!',
        message: `Filter ${f.toUpperCase()} diterapkan ke seluruh foto.`,
      });
    }
  };

  // Sticker actions (Drag, Update, Delete)
  const handleAddSticker = (stk: Omit<StickerElement, 'id' | 'x' | 'y'>) => {
    const newSticker: StickerElement = {
      ...stk,
      id: 'stk_' + Math.random().toString(36).substring(2, 7),
      x: 400 + Math.random() * 400,
      y: 500 + Math.random() * 600,
      scale: 1,
      rotation: 0,
    };
    const updated = [...stickers, newSticker];
    setStickers(updated);
    pushHistory({ stickers: updated });
    setSelectedElement({ type: 'sticker', id: newSticker.id });
    setSelectedSlotIndex(null);
    showToast({
      type: 'success',
      title: 'Stiker Ditambahkan!',
      message: 'Tarik ikon pojok kanan bawah ⤢ untuk ukuran, atau ikon atas ↻ untuk putar.',
    });
  };

  const handleUpdateSticker = (id: string, updates: Partial<StickerElement>) => {
    setStickers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const handleDeleteSticker = (id: string) => {
    const updated = stickers.filter((s) => s.id !== id);
    setStickers(updated);
    pushHistory({ stickers: updated });
    if (selectedElement?.id === id) {
      setSelectedElement(null);
    }
  };

  // Text actions (Drag, Update, Delete & Live Font/Color Switching)
  const selectedTextObj =
    selectedElement?.type === 'text'
      ? texts.find((t) => t.id === selectedElement.id) || null
      : null;

  const activeFontId = selectedTextObj ? selectedTextObj.fontFamily : selectedFont;
  const activeColorHex = selectedTextObj ? selectedTextObj.color : selectedColor;

  const handleSelectFont = (fontId: string) => {
    setSelectedFont(fontId);
    if (selectedTextObj) {
      const updated = texts.map((t) =>
        t.id === selectedTextObj.id ? { ...t, fontFamily: fontId } : t
      );
      setTexts(updated);
      pushHistory({ texts: updated });
      showToast({
        type: 'info',
        title: 'Font Diperbarui!',
        message: `Teks "${selectedTextObj.text}" kini menggunakan font ${fontId}.`,
      });
    }
  };

  const handleSelectColor = (colorHex: string) => {
    setSelectedColor(colorHex);
    if (selectedTextObj) {
      const updated = texts.map((t) =>
        t.id === selectedTextObj.id ? { ...t, color: colorHex } : t
      );
      setTexts(updated);
      pushHistory({ texts: updated });
    }
  };

  const handleApplyPreset = (preset: string) => {
    setCustomTextInput(preset);
    if (selectedTextObj) {
      const updated = texts.map((t) =>
        t.id === selectedTextObj.id ? { ...t, text: preset } : t
      );
      setTexts(updated);
      pushHistory({ texts: updated });
      showToast({
        type: 'success',
        title: 'Teks Diperbarui!',
        message: `Ucapan diubah menjadi "${preset}".`,
      });
    }
  };

  const handleAddTextSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customTextInput.trim()) return;

    const newTxt: TextElement = {
      id: 'txt_' + Math.random().toString(36).substring(2, 7),
      text: customTextInput.trim(),
      fontFamily: selectedFont,
      color: selectedColor,
      fontSize: 34,
      x: 600,
      y: 900 + (texts.length * 80),
      rotation: 0,
    };

    const updated = [...texts, newTxt];
    setTexts(updated);
    pushHistory({ texts: updated });
    setSelectedElement({ type: 'text', id: newTxt.id });
    setSelectedSlotIndex(null);
    setCustomTextInput('');

    showToast({
      type: 'success',
      title: 'Teks Ditambahkan!',
      message: 'Tarik ikon pojok kanan bawah ⤢ untuk ukuran, atau ikon atas ↻ untuk putar.',
    });
  };

  const handleTextFormSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customTextInput.trim()) return;

    if (selectedTextObj) {
      const newText = customTextInput.trim();
      const updated = texts.map((t) =>
        t.id === selectedTextObj.id ? { ...t, text: newText } : t
      );
      setTexts(updated);
      pushHistory({ texts: updated });
      showToast({
        type: 'success',
        title: 'Teks Berhasil Diubah!',
        message: `Teks diperbarui menjadi "${newText}".`,
      });
    } else {
      handleAddTextSubmit();
    }
  };

  const handleSelectTextItem = (t: TextElement) => {
    setSelectedElement({ type: 'text', id: t.id });
    setSelectedSlotIndex(null);
    setActiveTab('text');
    setSelectedFont(t.fontFamily);
    setSelectedColor(t.color);
    setCustomTextInput(t.text);
  };

  const handleStartNewText = () => {
    setSelectedElement(null);
    setCustomTextInput('');
  };

  // Canvas selection callbacks (Context-aware intelligent auto-tab switching)
  const handleSelectSlotFromCanvas = useCallback((index: number | null) => {
    setSelectedSlotIndex(index);
    if (index !== null) {
      setSelectedElement(null);
      setActiveTab((prev) => (prev === 'sticker' || prev === 'text' ? 'frame' : prev));
    }
  }, []);

  const handleSelectElementFromCanvas = (el: { type: 'sticker' | 'text'; id: string } | null) => {
    setSelectedElement(el);
    if (el) {
      setSelectedSlotIndex(null);
      if (el.type === 'text') {
        setActiveTab('text');
        const match = texts.find((t) => t.id === el.id);
        if (match) {
          setSelectedFont(match.fontFamily);
          setSelectedColor(match.color);
          setCustomTextInput(match.text);
        }
      } else if (el.type === 'sticker') {
        setActiveTab('sticker');
      }
    }
  };

  const handleUpdateText = (id: string, updates: Partial<TextElement>) => {
    setTexts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  const handleDeleteText = (id: string) => {
    const updated = texts.filter((t) => t.id !== id);
    setTexts(updated);
    pushHistory({ texts: updated });
    if (selectedElement?.id === id) {
      setSelectedElement(null);
      setCustomTextInput('');
    }
  };

  const saveActiveDesignToState = useCallback(() => {
    if (!selectedTemplate) return;
    setDesigns((prev) =>
      prev.map((d) => {
        if (d.id === activeDesignId) {
          return {
            ...d,
            template: selectedTemplate,
            slotPhotoMap,
            slotAdjustments,
            activeFilter,
            adjustments,
            stickers,
            texts,
            renderedDataUrl: renderedLayoutUrl || d.renderedDataUrl,
          };
        }
        return d;
      })
    );
  }, [selectedTemplate, activeDesignId, slotPhotoMap, slotAdjustments, activeFilter, adjustments, stickers, texts, renderedLayoutUrl]);

  const loadDesignIntoEditor = (d: FrameDesignState) => {
    setSelectedTemplate(d.template);
    setSlotPhotoMap(d.slotPhotoMap);
    setSlotAdjustments(d.slotAdjustments);
    setActiveFilter(d.activeFilter);
    setAdjustments(d.adjustments);
    setStickers(d.stickers);
    setTexts(d.texts);
    setRenderedLayoutUrl(d.renderedDataUrl);
    setSelectedSlotIndex(0);
    setSelectedElement(null);
  };

  const handleAddNewDesign = () => {
    if (!selectedTemplate) return;
    playButtonSound('secondary');
    saveActiveDesignToState();

    const newIndex = designs.length + 1;
    const newId = `design-${Date.now()}-${newIndex}`;

    const autoMap: Record<number, string> = {};
    selectedTemplate.slots.forEach((_, idx) => {
      if (allPhotos[idx]) {
        autoMap[idx] = allPhotos[idx];
      }
    });

    const newDesign: FrameDesignState = {
      id: newId,
      title: `Desain Frame #${newIndex}`,
      template: selectedTemplate,
      slotPhotoMap: autoMap,
      slotAdjustments: {},
      activeFilter: 'normal',
      adjustments: { brightness: 0, contrast: 0, rotation: 0 },
      stickers: [],
      texts: [],
      renderedDataUrl: '',
    };

    setDesigns((prev) => [...prev, newDesign]);
    setActiveDesignId(newId);
    loadDesignIntoEditor(newDesign);

    showToast({
      type: 'success',
      title: 'Desain Frame Baru Ditambahkan!',
      message: `Mulai mengedit ${newDesign.title}. Anda bebas membuat desain frame sebanyak-banyaknya selama waktu sesi berlangsung.`,
    });
  };

  const handleSwitchDesign = (targetId: string) => {
    if (targetId === activeDesignId) return;
    playButtonSound('secondary');
    saveActiveDesignToState();
    const target = designs.find((d) => d.id === targetId);
    if (target) {
      setActiveDesignId(target.id);
      loadDesignIntoEditor(target);
    }
  };

  const handleDuplicateDesign = (targetId: string) => {
    saveActiveDesignToState();
    const source = designs.find((d) => d.id === targetId);
    if (!source) return;
    playButtonSound('secondary');

    const newIndex = designs.length + 1;
    const newId = `design-${Date.now()}-${newIndex}`;
    const cloned: FrameDesignState = {
      ...source,
      id: newId,
      title: `Desain Frame #${newIndex} (Salinan)`,
      slotPhotoMap: { ...source.slotPhotoMap },
      slotAdjustments: { ...source.slotAdjustments },
      stickers: [...source.stickers],
      texts: [...source.texts],
    };

    setDesigns((prev) => [...prev, cloned]);
    setActiveDesignId(newId);
    loadDesignIntoEditor(cloned);

    showToast({
      type: 'success',
      title: 'Desain Berhasil Diduplikat!',
      message: `${cloned.title} dibuat. Anda dapat mengganti foto, filter, atau stiker dengan cepat.`,
    });
  };

  const handleDeleteDesign = (targetId: string) => {
    if (designs.length <= 1) {
      showToast({
        type: 'warning',
        title: 'Tidak Bisa Menghapus',
        message: 'Minimal harus ada 1 desain frame di sesi editor.',
      });
      return;
    }
    playButtonSound('delete');
    const remaining = designs.filter((d) => d.id !== targetId);
    setDesigns(remaining);
    if (activeDesignId === targetId) {
      const nextActive = remaining[0];
      setActiveDesignId(nextActive.id);
      loadDesignIntoEditor(nextActive);
    }
    showToast({
      type: 'info',
      title: 'Desain Dihapus',
      message: 'Desain frame telah dihapus dari koleksi sesi ini.',
    });
  };

  const handleCanvasRenderComplete = (url: string) => {
    setRenderedLayoutUrl(url);
    setDesigns((prev) =>
      prev.map((d) => (d.id === activeDesignId ? { ...d, renderedDataUrl: url } : d))
    );
  };

  // Timer Warning & Auto-Save on Expiry
  useEffect(() => {
    if (sessionSecondsLeft <= 0 && !timeoutHandledRef.current) {
      saveActiveDesignToState();
      setIsTimeoutAlertOpen(true);
      setTimeoutCountdown(5);
    }
  }, [sessionSecondsLeft, saveActiveDesignToState]);

  // Modal countdown before auto-redirecting
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isTimeoutAlertOpen && !timeoutHandledRef.current) {
      interval = setInterval(() => {
        setTimeoutCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            handleConfirmTimeoutProceed();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimeoutAlertOpen]);

  const handleConfirmTimeoutProceed = () => {
    if (timeoutHandledRef.current) return;
    timeoutHandledRef.current = true;
    setIsTimeoutAlertOpen(false);
    handleProceedWithAllDesigns();
  };

  const handleProceedWithAllDesigns = async () => {
    saveActiveDesignToState();

    const compiledDesigns: SavedFrameDesignItem[] = (
      await Promise.all(
        designs.map(async (d, idx) => {
          const isCurrentActive = d.id === activeDesignId;
          let finalUrl = isCurrentActive ? (renderedLayoutUrl || d.renderedDataUrl) : d.renderedDataUrl;

          // Jika desain frame belum ter-render (misal desain di latar belakang), ekspor secara headless via PhotoEngine 300 DPI
          if (!finalUrl && d.template) {
            try {
              const photoUrls = d.template.slots.map((_, i) => d.slotPhotoMap[i] || '');
              const res = await PhotoEngine.exportPrintReady({
                template: d.template,
                photoUrls,
                filter: d.activeFilter,
                adjustments: d.adjustments,
                slotAdjustments: d.slotAdjustments,
                stickers: d.stickers,
                texts: d.texts,
              });
              finalUrl = res.dataUrl;
            } catch (err) {
              console.warn('[PhotoEditorScreen] Gagal headless render frame design:', err);
            }
          }

          return {
            id: d.id,
            title: d.title || `Desain Frame #${idx + 1}`,
            layoutUrl: finalUrl || (allPhotos[0] || ''),
            templateName: d.template?.name || selectedTemplate?.name,
            slotsCount: d.template?.slots?.length || selectedTemplate?.slots?.length,
          };
        })
      )
    ).filter((item) => Boolean(item.layoutUrl));

    if (compiledDesigns.length === 0) {
      compiledDesigns.push({
        id: `design-fallback`,
        title: 'Desain Frame #1',
        layoutUrl: renderedLayoutUrl || allPhotos[0] || '',
        templateName: selectedTemplate?.name,
        slotsCount: selectedTemplate?.slots?.length,
      });
    }

    onProceed(compiledDesigns, allPhotos);
  };

  const handleOpenConfirmPrint = () => {
    saveActiveDesignToState();
    setIsConfirmPrintOpen(true);
  };

  if (!selectedTemplate) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-background text-white select-none">
        <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4 shadow-glow-primary" />
        <p className="text-sm font-bold text-slate-200">Memuat Studio & Frame Foto...</p>
        <p className="text-xs text-slate-500 mt-1">Menyiapkan kanvas foto resolusi tinggi</p>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col justify-between p-5 xl:p-6 2xl:p-7 select-none bg-background overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-3.5 px-1 border-b border-white/10 flex-shrink-0">
        <Button
          variant="ghost"
          size="md"
          onClick={() => setIsConfirmCancelOpen(true)}
          leftIcon={<ArrowLeft className="w-5 h-5" />}
        >
          Kembali
        </Button>

        <div className="text-center">
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2 justify-center">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span>Editor Studio & Tata Letak Foto</span>
          </h2>
          <p className="text-xs text-slate-400">
            Pilih foto di panel kiri untuk dimasukkan ke slot frame satu per satu • Atur crop, filter, stiker & teks
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Digital High-Visibility Session Timer Capsule */}
          <SessionTimerBadge secondsLeft={sessionSecondsLeft} />

          <Button
            variant="gold"
            size="md"
            onClick={handleOpenConfirmPrint}
            rightIcon={<ArrowRight className="w-5 h-5" />}
          >
            Lanjut Cetak ({designs.length} Desain)
          </Button>
        </div>
      </div>

      {/* Main 3-Column Work Area with generous gutters */}
      <div className="flex-1 flex gap-4 xl:gap-5 my-2.5 min-h-0 items-stretch px-1">
        {/* Left Column: Session Photo Reel Tray (Koleksi Foto Sesi) */}
        <div className="w-[280px] xl:w-[305px] 2xl:w-[325px] flex flex-col h-full glass-panel-elevated rounded-3xl p-4.5 xl:p-5 border border-white/10 flex-shrink-0 overflow-hidden shadow-2xl">
          {/* Reel Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-400 flex items-center justify-center border border-amber-400/30">
                <Images className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-white tracking-wide">Foto Sesi Kamu</h3>
                <span className="text-[10px] text-slate-400 font-semibold">{allPhotos.length} / 10 Foto</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleAutoFillSlots}
                className="px-2 py-1 rounded-xl bg-amber-400/20 text-amber-300 hover:bg-amber-400/30 text-[10px] font-bold border border-amber-400/30 active:scale-95 transition-all"
                title="Isi otomatis semua slot sesuai urutan foto"
              >
                Auto Isi
              </button>
              <button
                type="button"
                onClick={handleClearAllSlots}
                className="px-2 py-1 rounded-xl glass-panel text-slate-300 hover:text-white text-[10px] font-bold border border-white/10 active:scale-95 transition-all"
                title="Kosongkan semua slot frame"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Subtitle helper */}
          <div className="py-2 flex items-center justify-between text-[10px] text-slate-400 border-b border-white/5 flex-shrink-0">
            <span>Sentuh foto / seret ke frame</span>
            <span className="text-sky-400 font-bold">
              {selectedSlotIndex !== null ? `Slot #${selectedSlotIndex + 1} Aktif` : 'Pilih Slot'}
            </span>
          </div>

          {/* Scrollable Photo Reel List with internal edge margin */}
          <div className="flex-1 overflow-y-auto space-y-3 px-1 pt-2">
            {allPhotos.map((photoUrl, photoIdx) => {
              const assignedSlots = selectedTemplate.slots
                .map((_, sIdx) => (slotPhotoMap[sIdx] === photoUrl ? sIdx + 1 : null))
                .filter((n): n is number => n !== null);

              const isAssigned = assignedSlots.length > 0;

              return (
                <div
                  key={photoIdx}
                  draggable="true"
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', photoUrl);
                    e.dataTransfer.setData('photoUrl', photoUrl);
                  }}
                  onClick={() => {
                    if (selectedSlotIndex !== null) {
                      handleAssignPhotoToSlot(selectedSlotIndex, photoUrl);
                    } else {
                      const firstEmpty = selectedTemplate.slots.findIndex((_, idx) => !slotPhotoMap[idx]);
                      handleAssignPhotoToSlot(firstEmpty !== -1 ? firstEmpty : 0, photoUrl);
                    }
                  }}
                  className={`group relative rounded-2xl glass-panel p-2 border transition-all cursor-grab active:cursor-grabbing hover:border-sky-400/60 hover:shadow-glow-primary ${isAssigned ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-white/10'
                    }`}
                >
                  {/* Photo Thumbnail */}
                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-950/60 border border-white/10">
                    <img
                      src={photoUrl}
                      alt={`Foto Sesi #${photoIdx + 1}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none"
                    />

                    {/* Photo index badge */}
                    <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-lg bg-slate-950/85 backdrop-blur-md border border-white/20 text-[10px] font-black text-white shadow-md">
                      #{photoIdx + 1}
                    </div>

                    {/* Assigned slot badge */}
                    <div className="absolute top-1.5 right-1.5">
                      {isAssigned ? (
                        <div className="px-2 py-0.5 rounded-lg bg-emerald-500 text-slate-950 text-[10px] font-black flex items-center gap-1 shadow-md">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Slot {assignedSlots.join(', ')}</span>
                        </div>
                      ) : (
                        <div className="px-2 py-0.5 rounded-lg bg-slate-900/85 backdrop-blur-md border border-white/20 text-[10px] font-bold text-slate-400">
                          Bebas
                        </div>
                      )}
                    </div>

                    {/* Drag overlay hint */}
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <span className="text-[10px] font-bold text-white bg-slate-950/90 px-2 py-0.5 rounded-full border border-white/20 shadow-lg">
                        Sentuh / Tarik ke Slot
                      </span>
                    </div>
                  </div>

                  {/* Slot Assignment Quick Picker Buttons */}
                  <div className="mt-1.5 pt-1.5 border-t border-white/5 flex items-center justify-between gap-1">
                    <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">Pasang ke:</span>
                    <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                      {selectedTemplate.slots.map((_, sIdx) => {
                        const isThisSlotUsingThisPhoto = slotPhotoMap[sIdx] === photoUrl;
                        return (
                          <button
                            key={sIdx}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAssignPhotoToSlot(sIdx, photoUrl);
                            }}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-all active:scale-90 ${isThisSlotUsingThisPhoto
                                ? 'bg-emerald-400 text-slate-950 ring-1 ring-white shadow-sm'
                                : 'glass-panel text-slate-300 hover:text-white hover:bg-sky-400/20 hover:border-sky-400/40 border-white/10'
                              }`}
                            title={`Masukkan foto #${photoIdx + 1} ke Slot #${sIdx + 1}`}
                          >
                            Slot {sIdx + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            {allPhotos.length === 0 && (
              <div className="p-4 rounded-2xl glass-panel border border-white/10 text-center space-y-2 mt-4">
                <p className="text-xs text-slate-400">Belum ada foto yang diambil.</p>
                <button
                  type="button"
                  onClick={onBack}
                  className="px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs"
                >
                  Ambil Foto Sekarang
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Center Column: Interactive Studio Canvas with Slot Selector Strip */}
        <div className="flex-1 h-full flex flex-col items-center justify-center min-w-0">
          {/* Multi-Frame Design Switcher Bar (User bisa edit sepuasnya foto frame) */}
          <div className="w-full flex items-center justify-between px-2 pb-2 flex-shrink-0 gap-2">
            <div className="flex items-center gap-1.5 p-1.5 rounded-2xl glass-panel-elevated border border-amber-500/30 overflow-x-auto max-w-full">
              <span className="text-[11px] font-black text-amber-400 px-2 flex items-center gap-1 whitespace-nowrap">
                <Layers className="w-3.5 h-3.5" />
                <span>Desain Frame ({designs.length}):</span>
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                {designs.map((d, dIdx) => {
                  const isActive = d.id === activeDesignId;
                  return (
                    <div
                      key={d.id}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-xl transition-all ${
                        isActive
                          ? 'bg-amber-400 text-slate-950 font-black shadow-glow-primary ring-2 ring-white scale-100'
                          : 'glass-panel text-slate-300 hover:text-white border border-white/10 hover:border-amber-400/40'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSwitchDesign(d.id)}
                        className="text-xs font-bold whitespace-nowrap text-left"
                      >
                        {d.title || `Desain #${dIdx + 1}`}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateDesign(d.id);
                        }}
                        className={`p-1 rounded-md transition-colors ${
                          isActive
                            ? 'text-slate-900 hover:bg-black/10'
                            : 'text-slate-400 hover:text-amber-400 hover:bg-white/10'
                        }`}
                        title="Duplikat Desain Ini"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      {designs.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDesign(d.id);
                          }}
                          className={`p-1 rounded-md transition-colors ${
                            isActive
                              ? 'text-slate-900 hover:bg-rose-500 hover:text-white'
                              : 'text-slate-400 hover:text-rose-400 hover:bg-white/10'
                          }`}
                          title="Hapus Desain"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleAddNewDesign}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-md whitespace-nowrap ml-1"
                title="Buat desain frame baru dalam sesi ini"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Desain Baru</span>
              </button>
            </div>
          </div>

          {/* Quick Slot Selector Strip on Top of Canvas */}
          <div className="w-full flex items-center justify-between px-2 pb-2 flex-shrink-0 gap-2">
            <div className="flex items-center gap-2 p-2 rounded-2xl glass-panel border border-white/10 overflow-x-auto custom-scrollbar">
              <span className="text-[11px] font-bold text-slate-400 px-1 flex items-center gap-1 whitespace-nowrap">
                <Crop className="w-3.5 h-3.5 text-sky-400" />
                <span>Slot Frame:</span>
              </span>
              {selectedTemplate.slots.map((_, idx) => {
                const isSelected = selectedSlotIndex === idx;
                const slotFilter = slotAdjustments[idx]?.filter || activeFilter;
                const photoUrl = slotPhotoMap[idx];
                const hasPhoto = Boolean(photoUrl);
                return (
                  <div key={idx} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSlotIndex(idx);
                        setSelectedElement(null);
                        if (activeTab === 'sticker' || activeTab === 'text') {
                          setActiveTab('frame');
                        }
                        if (!hasPhoto) {
                          setPickingForSlot(idx);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 active:scale-95 touch-manipulation whitespace-nowrap ${
                        isSelected
                          ? 'bg-sky-400 text-slate-950 shadow-glow-primary ring-2 ring-white scale-105'
                          : hasPhoto
                            ? 'glass-panel text-white border-emerald-500/40 bg-emerald-950/20'
                            : 'glass-panel text-amber-300 hover:text-white border-dashed border-amber-400/40 bg-amber-500/10'
                      }`}
                      title={hasPhoto ? `Slot #${idx + 1} (Terisi foto)` : `Slot #${idx + 1} (Kosong - sentuh untuk pasang foto)`}
                    >
                      {/* Slot Mini Thumbnail or Indicator */}
                      {hasPhoto ? (
                        <div className="w-5 h-5 rounded-md overflow-hidden bg-slate-950 border border-white/20 flex-shrink-0">
                          <img src={photoUrl} alt={`Foto Slot #${idx + 1}`} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                      )}

                      <span>Slot #{idx + 1}</span>

                      {hasPhoto ? (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-300">
                          Terisi
                        </span>
                      ) : (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-400/25 text-amber-300">
                          + Pasang
                        </span>
                      )}

                      {slotFilter !== 'normal' && (
                        <span className="w-2 h-2 rounded-full bg-amber-400" title={`Filter: ${slotFilter}`} />
                      )}
                    </button>

                    {hasPhoto && (
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSlotIndex(idx);
                            setPickingForSlot(idx);
                          }}
                          className="px-2 py-1 rounded-lg glass-panel hover:bg-sky-400/20 text-sky-300 text-[10px] font-black border border-sky-400/30 active:scale-90 transition-all"
                          title={`Ganti foto di Slot #${idx + 1}`}
                        >
                          Ganti
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClearSlot(idx);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-400 active:scale-90 transition-colors"
                          title={`Lepas foto dari Slot #${idx + 1}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Quick Swap Button if template has multiple slots */}
              {selectedTemplate.slots.length >= 2 && (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedTemplate.slots.length === 2) {
                      handleSwapSlots(0, 1);
                    } else if (selectedSlotIndex !== null) {
                      const nextTarget = (selectedSlotIndex + 1) % selectedTemplate.slots.length;
                      handleSwapSlots(selectedSlotIndex, nextTarget);
                    } else {
                      handleSwapSlots(0, 1);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 text-xs font-bold flex items-center gap-1.5 border border-amber-400/30 active:scale-95 transition-all whitespace-nowrap ml-1"
                  title="Tukar posisi foto antar slot"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400" />
                  <span>Tukar Posisi</span>
                </button>
              )}
            </div>

            {/* Clean instruction banner placed outside and above the canvas frame */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/15 text-xs text-slate-200 shadow-md max-w-md">
              {selectedSlotIndex !== null ? (
                <>
                  <Crop className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                  <span className="truncate">
                    <strong className="text-sky-300">Slot #{selectedSlotIndex + 1}:</strong> Sentuh foto di kiri untuk pasang • Sentuh canvas untuk ganti foto • Geser untuk crop
                  </span>
                </>
              ) : selectedElement ? (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span className="truncate">
                    Tarik ikon pojok kanan bawah ⤢ untuk ukuran, ikon atas ↻ untuk putar
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span className="truncate">
                    Sentuh foto di panel kiri untuk isi frame • Sentuh langsung slot di kanvas
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Interactive Canvas */}
          <div className="flex-1 w-full h-full flex items-center justify-center min-h-0">
            <CanvasEditor
              template={selectedTemplate}
              photoUrls={renderedPhotoUrls}
              filter={activeFilter}
              adjustments={adjustments}
              slotAdjustments={slotAdjustments}
              selectedSlotIndex={selectedSlotIndex}
              onSelectSlot={handleSelectSlotFromCanvas}
              onSlotTap={(slotIdx) => {
                setSelectedSlotIndex(slotIdx);
                setPickingForSlot(slotIdx);
              }}
              onUpdateSlotAdjustment={handleUpdateSlotAdj}
              onDropPhotoOnSlot={handleAssignPhotoToSlot}
              stickers={stickers}
              texts={texts}
              selectedElement={selectedElement}
              onSelectElement={handleSelectElementFromCanvas}
              onUpdateSticker={handleUpdateSticker}
              onDeleteSticker={handleDeleteSticker}
              onUpdateText={handleUpdateText}
              onDeleteText={handleDeleteText}
              onDragEnd={() => pushHistory({ stickers, texts, slotAdjustments })}
              onRenderComplete={handleCanvasRenderComplete}
              className="w-full h-full"
            />
          </div>
        </div>

        {/* Right Column: Studio Panel (w-[480px] - w-[540px]) with 4 Organized Tabs */}
        <div className="w-[480px] xl:w-[510px] 2xl:w-[540px] flex flex-col h-full glass-panel-elevated rounded-3xl p-5 xl:p-5.5 border border-white/10 flex-shrink-0 overflow-hidden shadow-2xl">
          {/* Top Quick Actions Bar (Undo, Redo, Reset, Preview) */}
          <div className="pb-3.5 border-b border-white/10 flex-shrink-0 px-1">
            <EditorToolbar
              canUndo={historyIndex > 0}
              canRedo={historyIndex < history.length - 1}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onAddText={() => {
                setActiveTab('text');
                const el = document.getElementById('custom-text-input');
                el?.focus();
              }}
              onReset={handleReset}
              onTogglePreview={() => setIsPreviewOpen(true)}
              isPreviewOpen={isPreviewOpen}
            />
          </div>

          {/* 4 Studio Category Navigation Tabs */}
          <div className="grid grid-cols-4 gap-2.5 pt-3.5 pb-2.5 px-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('frame')}
              className={`py-3 px-2 rounded-2xl flex flex-col items-center gap-1.5 transition-all touch-manipulation active:scale-95 ${activeTab === 'frame'
                ? 'bg-amber-500 text-slate-950 font-black shadow-glow-primary'
                : 'glass-panel text-slate-300 hover:text-white border border-white/10'
                }`}
            >
              <Layout className="w-5 h-5" />
              <span className="text-[11px] font-bold leading-none">Bingkai & Crop</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('filter')}
              className={`py-3 px-2 rounded-2xl flex flex-col items-center gap-1.5 transition-all touch-manipulation active:scale-95 ${activeTab === 'filter'
                ? 'bg-amber-500 text-slate-950 font-black shadow-glow-primary'
                : 'glass-panel text-slate-300 hover:text-white border border-white/10'
                }`}
            >
              <Wand2 className="w-5 h-5" />
              <span className="text-[11px] font-bold leading-none">Filter Studio</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sticker')}
              className={`py-3 px-2 rounded-2xl flex flex-col items-center gap-1.5 transition-all touch-manipulation active:scale-95 ${activeTab === 'sticker'
                ? 'bg-amber-500 text-slate-950 font-black shadow-glow-primary'
                : 'glass-panel text-slate-300 hover:text-white border border-white/10'
                }`}
            >
              <SmilePlus className="w-5 h-5" />
              <span className="text-[11px] font-bold leading-none">Stiker ({stickers.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('text')}
              className={`py-3 px-2 rounded-2xl flex flex-col items-center gap-1.5 transition-all touch-manipulation active:scale-95 ${activeTab === 'text'
                ? 'bg-amber-500 text-slate-950 font-black shadow-glow-primary'
                : 'glass-panel text-slate-300 hover:text-white border border-white/10'
                }`}
            >
              <Type className="w-5 h-5" />
              <span className="text-[11px] font-bold leading-none">Teks & Font</span>
            </button>
          </div>

          {/* Active Tab Content Area with internal edge margin */}
          <div className="flex-1 overflow-y-auto px-3.5 space-y-4 py-2 custom-scrollbar">
            {/* TAB 1: BINGKAI & CROP FOTO */}
            {activeTab === 'frame' && (
              <div className="space-y-4">
                {/* 1. Pilihan Desain Bingkai & Susunan Foto */}
                <TemplateSelector
                  templates={templates}
                  selectedTemplateId={selectedTemplate.id}
                  onSelectTemplate={handleSelectTemplate}
                  slotPhotoMap={slotPhotoMap}
                  previewPhotos={allPhotos}
                />

                {/* 2. Crop & Resize Specific Photo Card */}
                {selectedSlotIndex !== null ? (
                  <div className="glass-panel rounded-2xl p-4 border border-sky-400/40 shadow-glow-primary space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-sky-400 animate-pulse" />
                        <span className="text-xs font-black uppercase tracking-wider text-sky-400">
                          Pengaturan Crop & Zoom Foto #{selectedSlotIndex + 1}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleResetSlotCrop(selectedSlotIndex)}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg glass-panel text-slate-300 hover:text-white flex items-center gap-1 active:scale-95 border border-white/10"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Reset Framing</span>
                      </button>
                    </div>

                    {/* Zoom / Resize Stepper & Slider */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-300 flex items-center gap-1.5">
                          <ZoomIn className="w-3.5 h-3.5 text-sky-400" />
                          <span>Perbesar / Perkecil (Zoom Foto):</span>
                        </span>
                        <span className="font-mono text-sky-400 font-bold">
                          {Math.round((currentSlotAdj.zoom || 1.0) * 100)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            const newZ = Math.max(1.0, Number(((currentSlotAdj.zoom || 1.0) - 0.1).toFixed(2)));
                            handleUpdateSlotAdj(selectedSlotIndex, { zoom: newZ });
                          }}
                          className="w-10 h-10 rounded-xl glass-panel text-white font-bold text-lg touch-manipulation active:scale-90 flex items-center justify-center border border-white/15"
                          title="Perkecil Zoom"
                        >
                          -
                        </button>
                        <input
                          type="range"
                          min={1.0}
                          max={2.5}
                          step={0.05}
                          value={currentSlotAdj.zoom || 1.0}
                          onChange={(e) =>
                            handleUpdateSlotAdj(selectedSlotIndex, { zoom: parseFloat(e.target.value) })
                          }
                          className="flex-1 h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newZ = Math.min(2.5, Number(((currentSlotAdj.zoom || 1.0) + 0.1).toFixed(2)));
                            handleUpdateSlotAdj(selectedSlotIndex, { zoom: newZ });
                          }}
                          className="w-10 h-10 rounded-xl glass-panel text-white font-bold text-lg touch-manipulation active:scale-90 flex items-center justify-center border border-white/15"
                          title="Perbesar Zoom"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Directional Pan / Crop Buttons */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-bold text-slate-300 block">
                        Geser Posisi Framing (Crop):
                      </span>
                      <div className="flex items-center justify-between gap-3 bg-slate-950/40 p-2.5 rounded-xl border border-white/10">
                        <div className="grid grid-cols-3 gap-1.5 w-36">
                          <div />
                          <button
                            type="button"
                            onClick={() => handlePanSlot(selectedSlotIndex, 0, -20)}
                            className="w-10 h-9 rounded-lg glass-panel text-slate-200 flex items-center justify-center hover:text-sky-400 active:scale-90 border border-white/15"
                            title="Geser ke Atas"
                          >
                            <ChevronUp className="w-5 h-5" />
                          </button>
                          <div />

                          <button
                            type="button"
                            onClick={() => handlePanSlot(selectedSlotIndex, -20, 0)}
                            className="w-10 h-9 rounded-lg glass-panel text-slate-200 flex items-center justify-center hover:text-sky-400 active:scale-90 border border-white/15"
                            title="Geser ke Kiri"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResetSlotCrop(selectedSlotIndex)}
                            className="w-10 h-9 rounded-lg bg-sky-500/20 text-sky-400 font-bold text-[9px] flex items-center justify-center active:scale-90 border border-sky-400/40"
                            title="Tengahkan"
                          >
                            CENTER
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePanSlot(selectedSlotIndex, 20, 0)}
                            className="w-10 h-9 rounded-lg glass-panel text-slate-200 flex items-center justify-center hover:text-sky-400 active:scale-90 border border-white/15"
                            title="Geser ke Kanan"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>

                          <div />
                          <button
                            type="button"
                            onClick={() => handlePanSlot(selectedSlotIndex, 0, 20)}
                            className="w-10 h-9 rounded-lg glass-panel text-slate-200 flex items-center justify-center hover:text-sky-400 active:scale-90 border border-white/15"
                            title="Geser ke Bawah"
                          >
                            <ChevronDown className="w-5 h-5" />
                          </button>
                          <div />
                        </div>

                        <div className="flex-1 flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => handleRotateSlot(selectedSlotIndex)}
                            className="w-full py-2 px-3 rounded-xl glass-panel text-xs font-bold text-slate-200 flex items-center justify-center gap-2 active:scale-95 border border-white/15 hover:border-sky-400"
                          >
                            <RotateCw className="w-4 h-4 text-sky-400" />
                            <span>Putar Foto 90°</span>
                          </button>
                          <p className="text-[10px] text-slate-400 leading-tight">
                            💡 Sentuh & geser foto langsung di atas canvas untuk crop framing bebas.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl glass-panel border border-white/10 text-center space-y-2">
                    <p className="text-xs text-slate-300 font-bold">
                      Sentuh salah satu foto di atas canvas atau pilih tombol foto untuk mengaktifkan crop & resize.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: FILTER STUDIO (PER FOTO ATAU SEMUA FOTO) */}
            {activeTab === 'filter' && (
              <div className="space-y-4">
                {/* Filter Scope Switcher: Foto Ini Saja vs Semua Foto */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-300 block">
                    Target Penerapan Filter:
                  </span>
                  <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl glass-panel border border-white/10">
                    <button
                      type="button"
                      onClick={() => setFilterScope('selected')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95 ${filterScope === 'selected'
                        ? 'bg-sky-400 text-slate-950 shadow-glow-primary'
                        : 'text-slate-300 hover:text-white glass-panel'
                        }`}
                    >
                      <Crop className="w-4 h-4" />
                      <span>Foto #{selectedSlotIndex !== null ? selectedSlotIndex + 1 : 1} Saja</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterScope('all')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95 ${filterScope === 'all'
                        ? 'bg-amber-500 text-slate-950 font-black shadow-glow-primary'
                        : 'text-slate-300 hover:text-white glass-panel'
                        }`}
                    >
                      <Layers className="w-4 h-4" />
                      <span>Semua Foto</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 px-1">
                    {filterScope === 'selected'
                      ? `Filter yang Anda pilih akan diterapkan KHUSUS pada Foto #${(selectedSlotIndex ?? 0) + 1}.`
                      : 'Filter yang Anda pilih akan diterapkan serentak ke seluruh foto dalam frame.'}
                  </p>
                </div>

                {/* 6 Studio Filter Cards Grid */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                      <Wand2 className="w-4 h-4" />
                      <span>Pilihan Filter Estetik Studio</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {STUDIO_FILTERS.map((f) => {
                      const currentSlotFilter =
                        selectedSlotIndex !== null
                          ? slotAdjustments[selectedSlotIndex]?.filter || activeFilter
                          : activeFilter;
                      const isFilterActive =
                        filterScope === 'selected'
                          ? currentSlotFilter === f.id
                          : activeFilter === f.id;

                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => handleApplyFilter(f.id)}
                          className={`p-3 rounded-2xl flex items-center gap-3 border text-left transition-all touch-manipulation active:scale-95 ${isFilterActive
                            ? 'bg-amber-500/20 border-amber-400 shadow-glow-primary ring-2 ring-amber-400'
                            : 'glass-panel hover:border-white/20 border-white/10'
                            }`}
                        >
                          <div
                            className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${f.previewColor} border border-white/20 shadow-md flex-shrink-0 flex items-center justify-center`}
                          >
                            {isFilterActive && <Check className="w-6 h-6 text-white stroke-[3]" />}
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm font-bold text-white block leading-tight truncate">
                              {f.label}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5 font-sans truncate">
                              {f.desc}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Status Filter Setiap Slot */}
                <div className="glass-panel p-3 rounded-2xl border border-white/10 space-y-2">
                  <span className="text-[11px] font-bold text-slate-300 block">
                    Status Filter Tiap Foto:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.slots.map((_, idx) => {
                      const fId = slotAdjustments[idx]?.filter || activeFilter;
                      const filterName = STUDIO_FILTERS.find((sf) => sf.id === fId)?.label || fId;
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            setSelectedSlotIndex(idx);
                            setFilterScope('selected');
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer active:scale-95 ${selectedSlotIndex === idx
                            ? 'bg-sky-400/20 text-sky-300 border-sky-400'
                            : 'glass-panel text-slate-300 border-white/10'
                            }`}
                        >
                          Foto #{idx + 1}: <span className="text-amber-400">{filterName}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: STIKER & EMOJI */}
            {activeTab === 'sticker' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400">
                    <SmilePlus className="w-4 h-4" />
                    <span>Koleksi Stiker Bebas Geser</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold bg-white/5 px-2.5 py-1 rounded-lg">
                    {stickers.length} terpasang
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/30 text-xs text-amber-300 flex items-center gap-2.5 shadow-sm">
                  <Sparkles className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Sentuh stiker di atas foto: tarik ikon pojok kanan bawah ⤢ untuk ukuran, atau ikon atas ↻ untuk putar bebas.
                  </span>
                </div>

                <StickerPicker
                  onAddSticker={handleAddSticker}
                  stickers={availableStickers.length > 0 ? availableStickers : undefined}
                />

                {/* List of installed stickers with delete */}
                {stickers.length > 0 && (
                  <div className="glass-panel rounded-2xl p-4 border border-white/10 space-y-2">
                    <span className="text-[11px] font-bold text-slate-300 block px-0.5">
                      Stiker Terpasang ({stickers.length}):
                    </span>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {stickers.map((s) => {
                        const isImg = s.url.startsWith('data:image/') || s.url.startsWith('http') || s.url.includes('.png');
                        return (
                          <div
                            key={s.id}
                            onClick={() => setSelectedElement({ type: 'sticker', id: s.id })}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm cursor-pointer active:scale-95 ${selectedElement?.id === s.id
                              ? 'bg-amber-500/25 border-amber-400 ring-1 ring-amber-400'
                              : 'glass-panel border-white/10'
                              }`}
                          >
                            {isImg ? (
                              <img
                                src={s.url}
                                alt={s.name}
                                className="w-5 h-5 object-contain pointer-events-none drop-shadow"
                              />
                            ) : (
                              <span className="text-xl leading-none">{s.url}</span>
                            )}
                            <span className="text-xs text-slate-300 font-medium max-w-[80px] truncate">{s.name}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSticker(s.id);
                              }}
                              className="text-slate-400 hover:text-red-400 active:scale-90 ml-1 p-0.5"
                              aria-label="Hapus stiker"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: TEKS & FONT TIPOGRAFI */}
            {activeTab === 'text' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400">
                    <Type className="w-4 h-4" />
                    <span>Teks Ucapan & Tipografi Bebas</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold bg-white/5 px-2.5 py-1 rounded-lg">
                    {texts.length} terpasang
                  </span>
                </div>

                {/* Status Banner: Mode Edit Teks Aktif vs Mode Teks Baru */}
                {selectedTextObj ? (
                  <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-amber-500/15 border border-amber-400/50 text-xs shadow-inner">
                    <div className="flex items-center gap-2 min-w-0 mr-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                      <span className="text-amber-300 font-bold whitespace-nowrap">Edit Teks:</span>
                      <span
                        className="text-white font-bold truncate max-w-[170px]"
                        style={{ fontFamily: selectedTextObj.fontFamily, color: selectedTextObj.color }}
                      >
                        "{selectedTextObj.text}"
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleStartNewText}
                      className="text-[10px] font-bold px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 border border-white/20 active:scale-95 flex-shrink-0 cursor-pointer"
                    >
                      + Buat Teks Baru
                    </button>
                  </div>
                ) : (
                  <div className="px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 text-[11px] text-slate-400">
                    Pilih font & warna di bawah. Anda bebas mengganti font atau warna kapan saja meski teks sudah ditambahkan ke foto!
                  </div>
                )}

                {/* Card 1: Pilihan Ragam Font Tipografi */}
                <div className="glass-panel rounded-2xl p-4 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold px-0.5">
                    <span className="text-slate-200">
                      Pilih Gaya Font ({displayFonts.length} Ragam):
                    </span>
                    {selectedTextObj && (
                      <span className="text-amber-400 text-[10px] font-semibold">
                        (Klik font untuk ubah teks)
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto px-0.5 py-1 custom-scrollbar">
                    {displayFonts.map((f) => {
                      const isSelected = activeFontId === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => handleSelectFont(f.id)}
                          className={`p-3 rounded-xl border text-left transition-all touch-manipulation active:scale-95 cursor-pointer relative ${isSelected
                            ? 'bg-amber-500/25 border-amber-400 shadow-glow-primary ring-1 ring-amber-400'
                            : 'glass-panel hover:border-white/20 border-white/10'
                            }`}
                        >
                          <span
                            className="text-base block truncate leading-tight"
                            style={{ fontFamily: f.id }}
                          >
                            {f.preview}
                          </span>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[9px] text-slate-400 block font-sans truncate">
                              {f.label}
                            </span>
                            {f.isCustom && (
                              <span className="text-[8px] bg-amber-500/20 text-amber-300 font-bold px-1 rounded">
                                Custom
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Card 2: Pilihan Warna Teks & Preset Ucapan Cepat */}
                <div className="glass-panel rounded-2xl p-4 border border-white/10 space-y-3.5">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold px-0.5">
                      <span className="text-slate-200">Pilihan Warna Teks:</span>
                      {selectedTextObj && (
                        <span className="text-amber-400 text-[10px] font-semibold">
                          (Klik warna untuk langsung ubah)
                        </span>
                      )}
                    </div>
                    {/* Generously padded color circles tray - no overflow clipping so rings and glows render fully */}
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-black/35 border border-white/10">
                      {COLOR_OPTIONS.map((c) => {
                        const isSelected = activeColorHex === c.hex;
                        return (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => handleSelectColor(c.hex)}
                            style={{ backgroundColor: c.hex }}
                            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex-shrink-0 transition-all duration-150 touch-manipulation active:scale-95 cursor-pointer shadow-md ${
                              c.hex === '#0F172A' ? 'border border-white/30' : ''
                            } ${
                              isSelected
                                ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-105 shadow-glow-primary'
                                : 'opacity-85 hover:opacity-100 hover:scale-105 hover:ring-1 hover:ring-white/40'
                            }`}
                            title={c.label}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Preset Ucapan Populer */}
                  <div className="space-y-2.5 pt-2 border-t border-white/10">
                    <span className="text-[11px] font-bold text-slate-300 block px-0.5">
                      Ide Tulisan & Ucapan Cepat:
                    </span>
                    <div className="flex flex-wrap gap-2.5 px-0.5">
                      {['Best Day Ever ✨', 'Happy Birthday 🎂', 'Sweet Memories 📸', 'Love You ❤️', 'Party Vibes 🎉'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleApplyPreset(preset)}
                          className="text-xs px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] text-slate-200 hover:text-white hover:border-amber-400/50 hover:bg-amber-400/10 active:scale-95 transition-all font-medium border border-white/10 cursor-pointer shadow-sm"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card 3: Form Input Teks & Tombol Tambah */}
                <div className="glass-panel rounded-2xl p-4 border border-white/10 space-y-2.5">
                  <span className="text-[11px] font-bold text-slate-300 block px-0.5">
                    Tulis Teks Kustom:
                  </span>
                  <form onSubmit={handleTextFormSubmit} className="flex gap-2.5">
                    <input
                      id="custom-text-input"
                      type="text"
                      value={customTextInput}
                      onChange={(e) => setCustomTextInput(e.target.value)}
                      placeholder={selectedTextObj ? 'Ketik tulisan baru...' : 'Ketik teks kustom...'}
                      maxLength={35}
                      style={{ fontFamily: activeFontId, color: activeColorHex }}
                      className="flex-1 h-12 rounded-xl glass-input px-4 text-sm font-bold outline-none border border-white/15 focus:border-amber-400"
                    />
                    <button
                      type="submit"
                      disabled={!customTextInput.trim()}
                      className="h-12 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 touch-manipulation active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-glow-primary flex-shrink-0 transition-all"
                    >
                      {selectedTextObj ? (
                        <>
                          <Sparkles className="w-4 h-4 stroke-[2.5]" />
                          <span>Ubah</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 stroke-[3]" />
                          <span>Tambah</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Card 4: List of active texts with delete button and tap to select */}
                {texts.length > 0 && (
                  <div className="glass-panel rounded-2xl p-4 border border-white/10 space-y-2.5">
                    <span className="text-[11px] font-bold text-slate-300 block px-0.5">
                      Teks Terpasang ({texts.length}):
                    </span>
                    <div className="flex flex-wrap gap-2.5 pt-0.5">
                      {texts.map((t) => {
                        const isSelected = selectedElement?.id === t.id;
                        return (
                          <div
                            key={t.id}
                            onClick={() => handleSelectTextItem(t)}
                            className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs border transition-all cursor-pointer active:scale-95 ${isSelected
                              ? 'bg-amber-500/25 border-amber-400 shadow-glow-primary ring-1 ring-amber-400'
                              : 'glass-panel border-white/15 hover:border-white/30'
                              }`}
                            style={{ color: t.color, fontFamily: t.fontFamily }}
                            title="Sentuh untuk mengedit teks, font & warna"
                          >
                            <span className="truncate max-w-[150px] font-bold">
                              "{t.text}"
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteText(t.id);
                              }}
                              className="text-slate-400 hover:text-red-400 active:scale-90 ml-1 p-0.5"
                              aria-label="Hapus teks"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Physical Print Layout Preview Modal */}
      <Layout4RPreview
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        onConfirmPrint={() => {
          setIsPreviewOpen(false);
          handleProceedWithAllDesigns();
        }}
        templateName={selectedTemplate.name}
        slotCount={selectedTemplate.slots.length}
        orientation={
          selectedTemplate.layoutType === '4R_LANDSCAPE' ||
          (selectedTemplate.width && selectedTemplate.height && selectedTemplate.width > selectedTemplate.height)
            ? 'landscape'
            : 'portrait'
        }
      >
        <CanvasEditor
          template={selectedTemplate}
          photoUrls={renderedPhotoUrls}
          filter={activeFilter}
          adjustments={adjustments}
          slotAdjustments={slotAdjustments}
          stickers={stickers}
          texts={texts}
          onRenderComplete={handleCanvasRenderComplete}
          className="w-full h-full p-0"
        />
      </Layout4RPreview>

      {/* Confirmation Dialog Sebelum Cetak Foto */}
      <ConfirmationDialog
        isOpen={isConfirmPrintOpen}
        title={`Lanjut ke Pemilihan Cetak (${designs.length} Desain)?`}
        message={`Semua ${designs.length} desain frame Anda telah disimpan secara aman. Di langkah berikutnya, Anda dapat memilih foto & frame mana saja yang ingin dicetak secara fisik ke kertas foto berkualitas.`}
        confirmLabel="Lanjut Pilih Foto & Cetak"
        cancelLabel="Periksa / Edit Lagi"
        variant="primary"
        onConfirm={() => {
          setIsConfirmPrintOpen(false);
          handleProceedWithAllDesigns();
        }}
        onCancel={() => setIsConfirmPrintOpen(false)}
      />

      {/* Confirmation Dialog Sebelum Keluar / Kembali ke Kamera */}
      <ConfirmationDialog
        isOpen={isConfirmCancelOpen}
        title="Kembali ke Kamera atau Ganti Foto?"
        message="Anda akan kembali ke sesi pemotretan. Foto-foto yang sudah Anda ambil tetap tersimpan di sesi ini, dan Anda bisa menghapus foto atau mengambil foto baru hingga maksimal 10 foto."
        confirmLabel="Ya, Kembali ke Kamera"
        cancelLabel="Tetap di Editor"
        variant="warning"
        onConfirm={() => {
          setIsConfirmCancelOpen(false);
          onBack();
        }}
        onCancel={() => setIsConfirmCancelOpen(false)}
      />

      {/* Session Timeout Warning & Auto-Save Modal */}
      <Modal
        isOpen={isTimeoutAlertOpen}
        maxWidth="md"
        showCloseButton={false}
      >
        <div className="p-6 text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border-2 border-amber-400/40 shadow-glow-primary animate-bounce">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-black uppercase tracking-wider border border-amber-400/30">
              Pemberitahuan Waktu Sesi
            </span>
            <h3 className="text-2xl font-black text-white tracking-tight">
              Waktu Sesi Editing Telah Berakhir!
            </h3>
            <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              Jangan khawatir! Seluruh editan frame foto Anda telah kami <strong className="text-emerald-400">simpan secara otomatis</strong>.
            </p>
          </div>

          {/* Saved Designs Summary */}
          <div className="p-4 rounded-2xl glass-panel border border-white/10 text-left space-y-2.5 max-h-48 overflow-y-auto">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 pb-1 border-b border-white/10">
              <span>Desain Frame Tersimpan:</span>
              <span className="text-amber-400 font-mono font-bold">{designs.length} Desain</span>
            </div>
            <div className="space-y-1.5">
              {designs.map((d, idx) => (
                <div key={d.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-amber-400/20 text-amber-400 text-xs font-black flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-white leading-none">{d.title || `Desain #${idx + 1}`}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{d.template?.name || 'Layout Foto'}</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Tersimpan</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Di sesi berikutnya, Anda bebas memilih foto atau frame mana yang ingin dicetak ke kertas foto fisik.
          </p>

          {/* Auto Redirect Countdown & Action Button */}
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleConfirmTimeoutProceed}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 font-black text-sm tracking-wide shadow-glow-primary active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <span>Lanjut ke Sesi Cetak Foto ({timeoutCountdown}s)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Modal>

      {/* Touchscreen Slot Photo Picker Modal (Muncul saat user menyentuh slot di kanvas atau tombol Ganti/Pasang) */}
      <Modal
        isOpen={pickingForSlot !== null}
        onClose={() => setPickingForSlot(null)}
        title={
          pickingForSlot !== null
            ? `Pilih Foto untuk Slot #${pickingForSlot + 1}`
            : 'Pilih Foto'
        }
        maxWidth="lg"
      >
        <div className="p-5 space-y-4 select-none">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <p className="text-xs text-slate-300">
              Sentuh salah satu foto sesi di bawah untuk langsung memasukkannya ke{' '}
              <strong className="text-sky-400">
                Slot #{pickingForSlot !== null ? pickingForSlot + 1 : 1}
              </strong>
            </p>
            {pickingForSlot !== null && slotPhotoMap[pickingForSlot] && (
              <button
                type="button"
                onClick={() => {
                  handleClearSlot(pickingForSlot);
                  setPickingForSlot(null);
                }}
                className="px-2.5 py-1 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-bold border border-rose-500/40 active:scale-95 transition-all"
              >
                Kosongkan Slot Ini
              </button>
            )}
          </div>

          {/* Grid of all captured photos with large touchable targets */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 max-h-[58vh] overflow-y-auto p-1 custom-scrollbar">
            {allPhotos.map((photoUrl, pIdx) => {
              const isCurrentlyInThisSlot =
                pickingForSlot !== null && slotPhotoMap[pickingForSlot] === photoUrl;

              const assignedSlots = selectedTemplate.slots
                .map((_, sIdx) => (slotPhotoMap[sIdx] === photoUrl ? sIdx + 1 : null))
                .filter((n): n is number => n !== null);

              return (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() => {
                    if (pickingForSlot !== null) {
                      handleAssignPhotoToSlot(pickingForSlot, photoUrl);
                      setPickingForSlot(null);
                    }
                  }}
                  className={`group relative rounded-2xl p-2 border-2 transition-all active:scale-95 text-left flex flex-col gap-2 ${
                    isCurrentlyInThisSlot
                      ? 'border-emerald-400 bg-emerald-500/20 shadow-glow-primary scale-102 ring-2 ring-emerald-300'
                      : assignedSlots.length > 0
                        ? 'border-sky-400/40 bg-sky-950/20 hover:border-sky-400'
                        : 'border-white/10 glass-panel hover:border-amber-400/60'
                  }`}
                >
                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-white/10">
                    <img
                      src={photoUrl}
                      alt={`Foto Sesi #${pIdx + 1}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none"
                    />

                    {/* Photo index badge */}
                    <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-lg bg-slate-950/85 backdrop-blur-md border border-white/20 text-[11px] font-black text-white shadow-md">
                      #{pIdx + 1}
                    </div>

                    {/* Status badge */}
                    <div className="absolute top-1.5 right-1.5">
                      {isCurrentlyInThisSlot ? (
                        <div className="px-2 py-0.5 rounded-lg bg-emerald-400 text-slate-950 text-[10px] font-black flex items-center gap-1 shadow-md">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Slot Ini</span>
                        </div>
                      ) : assignedSlots.length > 0 ? (
                        <div className="px-2 py-0.5 rounded-lg bg-slate-900/90 text-sky-300 text-[10px] font-bold border border-sky-400/30">
                          Slot {assignedSlots.join(', ')}
                        </div>
                      ) : (
                        <div className="px-2 py-0.5 rounded-lg bg-slate-900/85 text-slate-400 text-[10px] font-bold border border-white/20">
                          Bebas
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-xs font-bold text-white">Foto #{pIdx + 1}</span>
                    <span
                      className={`text-[11px] font-black px-2 py-0.5 rounded-lg ${
                        isCurrentlyInThisSlot
                          ? 'bg-emerald-400 text-slate-950'
                          : 'bg-white/10 text-slate-300 group-hover:bg-amber-400 group-hover:text-slate-950'
                      }`}
                    >
                      {isCurrentlyInThisSlot ? 'Terpasang' : 'Pilih Foto'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pt-2 flex justify-end">
            <Button variant="ghost" size="md" onClick={() => setPickingForSlot(null)}>
              Tutup
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
