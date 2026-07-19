import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@ecommerce.com';
  const adminPassword = 'CambiaEstaClave123!';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log('El usuario admin ya existe, no se creó ninguno nuevo.');
    return;
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'Principal',
      role: 'ADMIN',
      provider: 'LOCAL',
    },
  });

  console.log('Usuario admin creado exitosamente:');
  console.log(`Email: ${admin.email}`);
  console.log(`Password: ${adminPassword} (cámbiala después de tu primer login)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });