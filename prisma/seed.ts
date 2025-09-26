// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
//import { PrismaClient } from '../generated/prisma';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Roles
  const adminRole = await prisma.roles.upsert({
    where: { nombre: 'ADMINISTRADOR' },
    update: {},
    create: { nombre: 'ADMINISTRADOR' },
  });
  await prisma.roles.upsert({
    where: { nombre: 'EVALUADOR' },
    update: {},
    create: { nombre: 'EVALUADOR' },
  });
  await prisma.roles.upsert({
    where: { nombre: 'RESPONSABLE_DE_AREA' },
    update: {},
    create: { nombre: 'RESPONSABLE_DE_AREA' },
  });

  // Fases
  await prisma.fases.upsert({
    where: { nombre_fase: 'CLASIFICATORIA' },
    update: { orden_fase: 1 },
    create: { nombre_fase: 'CLASIFICATORIA', orden_fase: 1 },
  });
  await prisma.fases.upsert({
    where: { nombre_fase: 'FINAL' },
    update: { orden_fase: 2 },
    create: { nombre_fase: 'FINAL', orden_fase: 2 },
  });

  // Admin
  const email = process.env.ADMIN_EMAIL ?? 'admin@olimpiadas.edu';
  const pass = process.env.ADMIN_PASSWORD ?? 'olimpiadas2024';
  const hash = await bcrypt.hash(pass, 10);

  await prisma.usuarios.upsert({
    where: { correo: email },
    update: {
      hash_password: hash,
      id_rol: adminRole.id_rol,
      activo: true,
      nombre: 'Administrador',
      apellido: 'General',
    },
    create: {
      correo: email,
      hash_password: hash,
      nombre: 'Administrador',
      apellido: 'General',
      id_rol: adminRole.id_rol,
      activo: true,
    },
  });

  console.log('Seed completado.');
}

void (async () => {
  try {
    await main();
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
