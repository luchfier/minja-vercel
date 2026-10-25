// src/config/env.ts
// Environment variable loader & validation
// Memvalidasi kehadiran semua variabel wajib saat startup.

import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  // Booth
  BOOTH_API_KEY: z.string().min(1, 'BOOTH_API_KEY is required'),

  // Midtrans (opsional saat development)
  MIDTRANS_SERVER_KEY: z.string().default(''),
  MIDTRANS_CLIENT_KEY: z.string().default(''),
  MIDTRANS_IS_PRODUCTION: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // Email Delivery (SMTP)
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z
    .string()
    .default('587')
    .transform((v) => parseInt(v, 10)),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('Minja Photobooth <noreply@minjaphotobooth.com>'),

  // Email Delivery via Resend (HTTPS REST Port 443 — Bebas Blokir ISP)
  RESEND_API_KEY: z.string().default(''),
  RESEND_FROM: z.string().default('Minja Photobooth <onboarding@resend.dev>'),

  // Object Storage (opsional saat development)
  S3_ENDPOINT: z.string().default(''),
  S3_ACCESS_KEY: z.string().default(''),
  S3_SECRET_KEY: z.string().default(''),
  S3_BUCKET_NAME: z.string().default('minjaphotobooth'),
  S3_REGION: z.string().default('auto'),

  // Digital Gallery Public URL
  GALLERY_BASE_URL: z.string().default(''),

  // App
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z
    .string()
    .default('3000')
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1).max(65535)),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

/**
 * Memuat dan memvalidasi environment variables.
 * Melempar error jika variabel wajib tidak ada.
 */
export function loadEnv(): Env {
  if (_env) return _env;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    console.error(
      `\n❌ Environment validation failed:\n${formatted}\n\nPastikan file .env sudah dikonfigurasi sesuai .env.example\n`
    );
    process.exit(1);
  }

  _env = result.data;
  return _env;
}

/**
 * Mengambil environment yang sudah divalidasi.
 * Harus dipanggil setelah loadEnv().
 */
export function getEnv(): Env {
  if (!_env) {
    throw new Error('Environment not loaded. Call loadEnv() first.');
  }
  return _env;
}
