// src/schemas/delivery.schema.ts
// Zod schemas untuk Distribusi Digital (Email Delivery & Cloud Storage Gallery)

import { z } from 'zod';

export const sendEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .min(5, 'Alamat email minimal 5 karakter')
    .max(100, 'Alamat email maksimal 100 karakter')
    .email('Format alamat email tidak valid'),
});

export const uploadGalleryFileSchema = z.object({
  fileType: z
    .preprocess((val) => {
      if (val === 'print_strip') return 'layout_4r';
      if (val === 'single_photo') return 'raw_photo';
      if (val === 'animated_gif') return 'layout_4r';
      return val;
    }, z.enum(['layout_4r', 'live_video', 'raw_photo']))
    .default('layout_4r'),
  dataUrl: z.string().min(1, 'Data URL / base64 content wajib disertakan'),
  fileName: z.string().optional(),
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;
export type UploadGalleryFileInput = z.infer<typeof uploadGalleryFileSchema>;
