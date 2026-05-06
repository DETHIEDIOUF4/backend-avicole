import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();

  const phone = process.env.ADMIN_PHONE ?? '770000000';
  const rawEmail = process.env.ADMIN_EMAIL;
  const email =
    typeof rawEmail === 'string' && rawEmail.trim().length > 0
      ? rawEmail.trim()
      : undefined;
  const password = process.env.ADMIN_PASSWORD ?? 'Admin123456';
  const firstName = process.env.ADMIN_FIRST_NAME ?? 'Super';
  const lastName = process.env.ADMIN_LAST_NAME ?? 'Admin';

  const passwordHash = await bcrypt.hash(password, 10);

  const baseData = {
    passwordHash,
    role: UserRole.ADMIN,
    firstName,
    lastName,
    isActive: true,
    ...(email !== undefined ? { email } : {}),
  };

  const existing = await prisma.user.findFirst({
    where: { phone },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { phone, ...baseData },
    });
  } else {
    await prisma.user.create({
      data: { phone, ...baseData },
    });
  }

  await prisma.$disconnect();
  console.log(`Admin seed ok: ${phone}`);
}

main().catch(async (error) => {
  console.error(error);
  await new PrismaClient().$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
