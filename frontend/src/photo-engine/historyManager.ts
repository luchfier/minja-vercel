// frontend/src/photo-engine/historyManager.ts
// Engine Histori Undo / Redo Komposisi Foto (Photo Engine)

import { HistorySnapshot } from './types';

export class EditorHistoryManager {
  private past: HistorySnapshot[] = [];
  private future: HistorySnapshot[] = [];
  private maxSnapshots: number;

  constructor(maxSnapshots = 25) {
    this.maxSnapshots = maxSnapshots;
  }

  /**
   * Menyimpan snapshot baru ke dalam riwayat undo
   */
  public push(snapshot: Omit<HistorySnapshot, 'id' | 'timestamp'>): void {
    const fullSnapshot: HistorySnapshot = {
      ...this.clone(snapshot),
      id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
    };

    this.past.push(fullSnapshot);
    if (this.past.length > this.maxSnapshots) {
      this.past.shift(); // Buang histori tertua jika melebihi batas memori
    }
    this.future = []; // Reset redo stack saat ada aksi baru
  }

  /**
   * Mengembalikan snapshot saat ini dan mundur ke snapshot sebelumnya
   */
  public undo(currentSnapshot: Omit<HistorySnapshot, 'id' | 'timestamp'>): HistorySnapshot | null {
    if (!this.canUndo) return null;

    const previous = this.past.pop()!;
    this.future.push({
      ...this.clone(currentSnapshot),
      id: `snap_future_${Date.now()}`,
      timestamp: Date.now(),
    });

    return previous;
  }

  /**
   * Maju ke snapshot berikutnya di stack redo
   */
  public redo(currentSnapshot: Omit<HistorySnapshot, 'id' | 'timestamp'>): HistorySnapshot | null {
    if (!this.canRedo) return null;

    const next = this.future.pop()!;
    this.past.push({
      ...this.clone(currentSnapshot),
      id: `snap_past_${Date.now()}`,
      timestamp: Date.now(),
    });

    return next;
  }

  public get canUndo(): boolean {
    return this.past.length > 0;
  }

  public get canRedo(): boolean {
    return this.future.length > 0;
  }

  public get historyDepth(): number {
    return this.past.length;
  }

  /**
   * Membersihkan seluruh riwayat histori (misal saat berganti frame atau reset)
   */
  public clear(): void {
    this.past = [];
    this.future = [];
  }

  /**
   * Deep clone helper untuk memastikan isolasi referensi data
   */
  private clone<T>(obj: T): T {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch {
      return { ...obj };
    }
  }
}
