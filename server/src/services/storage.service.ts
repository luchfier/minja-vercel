// src/services/storage.service.ts
// Service Penyimpanan Object Storage (Cloudflare R2 / AWS S3 / Local Fallback)
// Sesuai ARCHITECTURE.md §5.1 & THE_NEXT_STEP.md §6.1

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getEnv } from '../config/env.js';
import { renderMobileGalleryHtml } from '../templates/mobileGalleryPage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface UploadResult {
  key: string;
  publicUrl: string;
  sizeBytes: number;
  mimeType: string;
}

export interface SessionGalleryItem {
  key: string;
  fileName: string;
  fileType: 'layout_4r' | 'live_video' | 'raw_photo' | 'other';
  label: string;
  url: string;
  downloadUrl?: string;
  sizeBytes?: number;
}

export class StorageService {
  private baseDir: string;
  private s3Endpoint: string;
  private s3Bucket: string;
  private isS3Configured: boolean;
  private s3Client: S3Client | null = null;

  constructor() {
    const env = getEnv();
    this.s3Endpoint = env.S3_ENDPOINT || '';
    this.s3Bucket = env.S3_BUCKET_NAME || 'backup';
    this.isS3Configured =
      this.s3Endpoint.trim().length > 0 &&
      (env.S3_ACCESS_KEY || '').trim().length > 0 &&
      (env.S3_SECRET_KEY || '').trim().length > 0;

    if (this.isS3Configured) {
      this.s3Client = new S3Client({
        region: env.S3_REGION || 'auto',
        endpoint: this.s3Endpoint,
        credentials: {
          accessKeyId: env.S3_ACCESS_KEY,
          secretAccessKey: env.S3_SECRET_KEY,
        },
      });
    }

    // Direktori penyimpanan lokal: server/storage/galleries
    this.baseDir = path.resolve(__dirname, '../../storage/galleries');
    try {
      fs.mkdirSync(this.baseDir, { recursive: true });
    } catch {
      // ignore
    }
  }

  public isCloudStorageActive(): boolean {
    return this.isS3Configured;
  }

  public getBucketName(): string {
    return this.s3Bucket;
  }

  public getEndpoint(): string {
    return this.s3Endpoint;
  }

  /**
   * Mengunggah file ke penyimpanan lokal terlebih dahulu, lalu di-mirror ke Cloudflare R2
   */
  async uploadFile(
    sessionId: string,
    fileName: string,
    content: Buffer | string,
    mimeType = 'image/jpeg'
  ): Promise<UploadResult> {
    let buffer: Buffer;

    if (typeof content === 'string') {
      const commaIdx = content.indexOf(',');
      if (content.startsWith('data:') && commaIdx !== -1) {
        const header = content.slice(0, commaIdx);
        // Hapus whitespace & line breaks dari base64 string
        const dataPart = content.slice(commaIdx + 1).replace(/\s/g, '');

        const mimeMatch = header.match(/^data:([^;,]+)/);
        if (mimeMatch && mimeMatch[1]) {
          mimeType = mimeMatch[1].toLowerCase();
        }

        if (header.includes(';base64')) {
          buffer = Buffer.from(dataPart, 'base64');
        } else {
          buffer = Buffer.from(decodeURIComponent(dataPart), 'utf-8');
        }
      } else {
        const cleaned = content.trim().replace(/\s/g, '');
        if (/^[A-Za-z0-9+/=]+$/.test(cleaned) && cleaned.length % 4 === 0 && cleaned.length > 50) {
          buffer = Buffer.from(cleaned, 'base64');
        } else {
          buffer = Buffer.from(content, 'utf-8');
        }
      }
    } else {
      buffer = content;
    }

    if (!buffer || buffer.length === 0) {
      throw new Error(`Buffer untuk file ${fileName} kosong (0 byte). Upload dibatalkan untuk mencegah file korup.`);
    }

    // 1. Simpan salinan lokal di harddisk booth terlebih dahulu (Local Storage First)
    const sessionDir = path.join(this.baseDir, sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });

    const localFilePath = path.join(sessionDir, fileName);
    fs.writeFileSync(localFilePath, buffer);

    const stat = fs.statSync(localFilePath);
    if (stat.size !== buffer.length) {
      throw new Error(`Verifikasi penyimpanan lokal gagal untuk ${fileName}. Terbaca ${stat.size} bytes, diharapkan ${buffer.length} bytes.`);
    }
    console.info(`[StorageService:Local] Berhasil menyimpan file lokal: ${localFilePath} (${stat.size} bytes)`);

    const key = `${sessionId}/${fileName}`;
    const publicUrl = `/storage/galleries/${sessionId}/${fileName}`;

    // 2. Unggah ke Cloudflare R2 setelah file tersimpan aman di lokal
    if (this.s3Client && this.isS3Configured) {
      try {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.s3Bucket,
            Key: key,
            Body: buffer,
            ContentType: mimeType,
          })
        );
        console.info(`[StorageService:R2] Berhasil upload ${key} ke Cloudflare R2 bucket '${this.s3Bucket}'`);
      } catch (err) {
        console.warn(`[StorageService:R2] Gagal upload ${key} ke Cloudflare R2, file lokal tetap aman:`, err);
      }
    }

    return {
      key,
      publicUrl,
      sizeBytes: buffer.length,
      mimeType,
    };
  }

  /**
   * Menghasilkan URL unduh langsung yang aman (Presigned URL) dari Cloudflare R2
   * Berlaku selama expiresInSeconds (default: 48 jam / 172800 detik)
   */
  async getPresignedDownloadUrl(
    key: string,
    expiresInSeconds = 48 * 3600,
    contentDispositionFilename?: string
  ): Promise<string> {
    if (this.s3Client && this.isS3Configured) {
      try {
        const command = new GetObjectCommand({
          Bucket: this.s3Bucket,
          Key: key,
          ResponseContentDisposition: contentDispositionFilename
            ? `attachment; filename="${encodeURIComponent(contentDispositionFilename)}"`
            : undefined,
        });
        const signedUrl = await getSignedUrl(this.s3Client, command, {
          expiresIn: expiresInSeconds,
        });
        return signedUrl;
      } catch (err) {
        console.warn(`[StorageService:R2] Gagal membuat presigned URL untuk ${key}:`, err);
      }
    }
    return `/storage/galleries/${key}`;
  }

  /**
   * Mengambil daftar file digital galeri secara terstruktur (Layout 4R, Live Video, Raw Poses)
   * Berbasis Local Storage dengan fallback/overlay Cloudflare R2 Presigned URLs
   */
  async listSessionGalleryItems(sessionId: string): Promise<SessionGalleryItem[]> {
    const itemsMap = new Map<string, SessionGalleryItem>();
    const sessionDir = path.join(this.baseDir, sessionId);

    // 1. Baca direktori lokal booth (Local Storage First)
    if (fs.existsSync(sessionDir)) {
      const files = fs.readdirSync(sessionDir);
      for (const fileName of files) {
        const lower = fileName.toLowerCase();
        if (lower.includes('gallery.html')) continue;
        if (lower.endsWith('.gif')) continue; // Fitur GIF telah dihapus

        const filePath = path.join(sessionDir, fileName);
        try {
          const stat = fs.statSync(filePath);
          // Abaikan file kosong atau korup (< 100 bytes)
          if (stat.size < 100) continue;

          let fileType: SessionGalleryItem['fileType'] = 'other';
          let label = 'File Foto';

          if (lower.includes('strip') || lower.includes('layout') || lower.includes('4r') || lower.includes('design') || lower.includes('frame')) {
            fileType = 'layout_4r';
            label = 'Hasil Cetak 4R (10×15 cm)';
          } else if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.includes('live') || lower.includes('video')) {
            fileType = 'live_video';
            label = 'Live Photo (Video Motion)';
          } else if (lower.includes('photo') || lower.includes('pose') || lower.includes('raw') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png')) {
            fileType = 'raw_photo';
            label = 'Foto Pose HD';
          }

          let viewUrl = `/storage/galleries/${sessionId}/${fileName}`;
          let downloadUrl = `/api/public/gallery/${sessionId}/download/${fileName}`;

          // Jika Cloudflare R2 aktif, buatkan Presigned URL publik
          if (this.s3Client && this.isS3Configured) {
            try {
              const cloudView = await this.getPresignedDownloadUrl(`${sessionId}/${fileName}`, 48 * 3600);
              const cloudDown = await this.getPresignedDownloadUrl(`${sessionId}/${fileName}`, 48 * 3600, fileName);
              if (cloudView.startsWith('http')) {
                viewUrl = cloudView;
              }
              if (cloudDown.startsWith('http')) {
                downloadUrl = cloudDown;
              }
            } catch {
              // fallback ke url lokal
            }
          }

          itemsMap.set(fileName, {
            key: `${sessionId}/${fileName}`,
            fileName,
            fileType,
            label,
            url: viewUrl,
            downloadUrl,
            sizeBytes: stat.size,
          });
        } catch {
          // Abaikan error stat lokal
        }
      }
    }

    // 2. Jika Cloudflare R2 memiliki file tambahan yang mungkin belum ada di lokal
    if (this.s3Client && this.isS3Configured) {
      try {
        const res = await this.s3Client.send(
          new ListObjectsV2Command({
            Bucket: this.s3Bucket,
            Prefix: `${sessionId}/`,
          })
        );

        if (res.Contents && res.Contents.length > 0) {
          for (const obj of res.Contents) {
            if (!obj.Key) continue;
            const fileName = path.basename(obj.Key);
            const lower = fileName.toLowerCase();
            if (lower.includes('gallery.html')) continue;
            if (lower.endsWith('.gif')) continue;
            if (obj.Size && obj.Size < 100) continue; // Abaikan object R2 yang korup/kosong

            if (!itemsMap.has(fileName)) {
              let fileType: SessionGalleryItem['fileType'] = 'other';
              let label = 'File Foto';

              if (lower.includes('strip') || lower.includes('layout') || lower.includes('4r') || lower.includes('design') || lower.includes('frame')) {
                fileType = 'layout_4r';
                label = 'Hasil Cetak 4R (10×15 cm)';
              } else if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.includes('live') || lower.includes('video')) {
                fileType = 'live_video';
                label = 'Live Photo (Video Motion)';
              } else if (lower.includes('photo') || lower.includes('pose') || lower.includes('raw') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png')) {
                fileType = 'raw_photo';
                label = 'Foto Pose HD';
              }

              const viewUrl = await this.getPresignedDownloadUrl(obj.Key, 48 * 3600);
              const downloadUrl = await this.getPresignedDownloadUrl(obj.Key, 48 * 3600, fileName);

              itemsMap.set(fileName, {
                key: obj.Key,
                fileName,
                fileType,
                label,
                url: viewUrl,
                downloadUrl,
                sizeBytes: obj.Size,
              });
            }
          }
        }
      } catch (err) {
        console.warn(`[StorageService:R2] Gagal sync ListObjects dari R2:`, err);
      }
    }

    return Array.from(itemsMap.values());
  }

  /**
   * Mempublikasikan halaman galeri HTML mandiri langsung ke Local Storage & Cloudflare R2
   */
  async publishCloudGallery(
    sessionId: string,
    sessionCode: string,
    expiresAt: string,
    boothName = 'Minja Photobooth'
  ): Promise<string> {
    const items = await this.listSessionGalleryItems(sessionId);
    const html = renderMobileGalleryHtml({
      boothName,
      sessionId,
      sessionCode,
      expiresAt,
      items,
    });

    // 1. Simpan salinan lokal gallery.html
    const sessionDir = path.join(this.baseDir, sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });
    const localHtmlPath = path.join(sessionDir, 'gallery.html');
    fs.writeFileSync(localHtmlPath, html, 'utf-8');

    // 2. Unggah ke Cloudflare R2 jika terkonfigurasi
    if (this.s3Client && this.isS3Configured) {
      try {
        const key = `${sessionId}/gallery.html`;
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.s3Bucket,
            Key: key,
            Body: Buffer.from(html, 'utf-8'),
            ContentType: 'text/html; charset=utf-8',
          })
        );

        const getCmd = new GetObjectCommand({
          Bucket: this.s3Bucket,
          Key: key,
          ResponseContentType: 'text/html; charset=utf-8',
        });

        const publicCloudUrl = await getSignedUrl(this.s3Client, getCmd, {
          expiresIn: 48 * 3600, // 48 jam
        });

        console.info(`[StorageService:R2] Berhasil mempublikasikan Cloud Gallery global ke R2 untuk sesi ${sessionId}`);
        return publicCloudUrl;
      } catch (err) {
        console.warn(`[StorageService:R2] Gagal mempublikasikan cloud gallery ke R2:`, err);
      }
    }

    return '';
  }

  /**
   * Mengambil daftar tautan unduh file digital untuk suatu sesi
   */
  async listSessionFiles(sessionId: string): Promise<string[]> {
    const items = await this.listSessionGalleryItems(sessionId);
    return items.map((it) => it.url);
  }

  /**
   * Menghapus file sesi yang telah kedaluwarsa (retensi 48 jam)
   */
  async cleanupExpiredSessions(retentionHours = 48): Promise<number> {
    let cleaned = 0;
    const now = Date.now();
    const maxAgeMs = retentionHours * 3600 * 1000;

    if (!fs.existsSync(this.baseDir)) return 0;

    const sessionFolders = fs.readdirSync(this.baseDir);
    for (const folder of sessionFolders) {
      const folderPath = path.join(this.baseDir, folder);
      try {
        const stat = fs.statSync(folderPath);
        if (stat.isDirectory() && now - stat.mtimeMs > maxAgeMs) {
          fs.rmSync(folderPath, { recursive: true, force: true });
          cleaned++;
        }
      } catch {
        // ignore errors
      }
    }

    return cleaned;
  }
}
