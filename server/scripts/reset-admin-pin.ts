// server/scripts/reset-admin-pin.ts
// Skrip Darurat Reset PIN Admin MinjaPhotobooth V2
// Penggunaan: npx tsx scripts/reset-admin-pin.ts [PIN_BARU]
// Contoh: npx tsx scripts/reset-admin-pin.ts 123456

import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

const ARGON2_CONFIG = {
  type: argon2.argon2id as const,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
  saltLength: 16,
};

async function resetPin() {
  const newPin = process.argv[2] || '123456';

  if (!/^\d{6,12}$/.test(newPin)) {
    console.error('❌ Error: PIN harus berupa angka antara 6 hingga 12 digit.');
    process.exit(1);
  }

  console.log(`\n🔄 Memproses reset PIN Admin menjadi: "${newPin}"...`);

  try {
    const pinHash = await argon2.hash(newPin, ARGON2_CONFIG);

    const existingAdmin = await prisma.admin.findFirst();

    if (existingAdmin) {
      await prisma.admin.update({
        where: { id: existingAdmin.id },
        data: {
          pinHash,
          failedAttempts: 0,
          lockedUntil: null, // Buka kunci jika sebelumnya ter-lockout
        },
      });
      console.log('✅ Berhasil me-reset PIN Admin!');
      console.log(`   PIN Baru: ${newPin}`);
      console.log('   Status Akun: Unlocked (Terkunci dibatalkan & counter salah direset ke 0).\n');
    } else {
      await prisma.admin.create({
        data: {
          pinHash,
          failedAttempts: 0,
          lockedUntil: null,
        },
      });
      console.log('✅ Admin baru berhasil dibuat!');
      console.log(`   PIN: ${newPin}\n`);
    }
  } catch (err) {
    console.error('❌ Gagal me-reset PIN Admin via database:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetPin();
