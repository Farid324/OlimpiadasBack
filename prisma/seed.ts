// prisma/seed.ts
import 'dotenv/config'; // ← asegura que carguen ADMIN_EMAIL, etc. al ejecutar con tsx
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // ------- Roles -------
  const adminRole = await prisma.roles.upsert({
    where: { nombre: 'ADMINISTRADOR' },
    update: {},
    create: { nombre: 'ADMINISTRADOR' },
  });

  const evalRole = await prisma.roles.upsert({
    where: { nombre: 'EVALUADOR' },
    update: {},
    create: { nombre: 'EVALUADOR' },
  });

  const respRole = await prisma.roles.upsert({
    where: { nombre: 'RESPONSABLE_DE_AREA' },
    update: {},
    create: { nombre: 'RESPONSABLE_DE_AREA' },
  });

  // ------- Fases -------
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

  // ------- Áreas (necesarias para HU-05) -------
  const areaMate = await prisma.areas.upsert({
    where: { nombre_area: 'Matemática' },
    update: {},
    create: { nombre_area: 'Matemática', activo: true },
  });

  const areaFisica = await prisma.areas.upsert({
    where: { nombre_area: 'Física' },
    update: {},
    create: { nombre_area: 'Física', activo: true },
  });

  // ------- Admin -------
  const emailAdmin = process.env.ADMIN_EMAIL ?? 'admin@olimpiadas.edu';
  const passAdmin = process.env.ADMIN_PASSWORD ?? 'olimpiadas2024';
  const hashAdmin = await bcrypt.hash(passAdmin, 10);

  await prisma.usuarios.upsert({
    where: { correo: emailAdmin },
    update: {
      hash_password: hashAdmin,
      id_rol: adminRole.id_rol,
      activo: true,
      nombre: 'Rodrigo',
      apellido: 'Camacho',
    },
    create: {
      correo: emailAdmin,
      hash_password: hashAdmin,
      nombre: 'Rodrigo',
      apellido: 'Camacho',
      id_rol: adminRole.id_rol,
      activo: true,
    },
  });

  // ------- Evaluador (demo) -------
  const evalEmail = process.env.EVAL_EMAIL ?? 'eval.math@olimpiadas.edu';
  const evalPass = process.env.EVAL_PASSWORD ?? 'olimpiadas2024';
  const evalHash = await bcrypt.hash(evalPass, 10);

  const evaluador = await prisma.usuarios.upsert({
    where: { correo: evalEmail },
    update: {
      hash_password: evalHash,
      id_rol: evalRole.id_rol,
      activo: true,
      nombre: 'María',
      apellido: 'Fernández',
    },
    create: {
      correo: evalEmail,
      hash_password: evalHash,
      nombre: 'María',
      apellido: 'Fernández',
      id_rol: evalRole.id_rol,
      activo: true,
      institucion: 'UMSS',
      especialidad: 'Matemáticas Aplicadas',
      experiencia: 12,
      telefono: '70123456',
    },
  });

  // Relaciona evaluador con 2 áreas (Matemática y Física)
  await prisma.evaluadores_area.createMany({
    data: [
      { id_usuario: evaluador.id_usuario, id_area: areaMate.id_area, activo: true },
      { id_usuario: evaluador.id_usuario, id_area: areaFisica.id_area, activo: true },
    ],
    skipDuplicates: true,
  });

  // ------- Responsable (demo) -------
  const respEmail = process.env.RESP_EMAIL ?? 'resp.math@olimpiadas.edu';
  const respPass = process.env.RESP_PASSWORD ?? 'olimpiadas2024';
  const respHash = await bcrypt.hash(respPass, 10);

  const responsable = await prisma.usuarios.upsert({
    where: { correo: respEmail },
    update: {
      hash_password: respHash,
      id_rol: respRole.id_rol,
      activo: true,
      nombre: 'Ana',
      apellido: 'Martínez',
    },
    create: {
      correo: respEmail,
      hash_password: respHash,
      nombre: 'Ana',
      apellido: 'Martínez',
      id_rol: respRole.id_rol,
      activo: true,
      institucion: 'Instituto Tecnológico',
      especialidad: 'Física Teórica',
      experiencia: 10,
      telefono: '78987654',
    },
  });

  await prisma.areas.upsert({
    where: { nombre_area: 'Matemática' },
    update: {},
    create: { nombre_area: 'Matemática' },
  });
  await prisma.areas.upsert({
    where: { nombre_area: 'Física' },
    update: {},
    create: { nombre_area: 'Física' },
  });


  // Relaciona responsable con el área Matemática
  await prisma.responsables_area.createMany({
    data: [{ id_usuario: responsable.id_usuario, id_area: areaMate.id_area, activo: true }],
    skipDuplicates: true,
  });

  console.log('✅ Seed OK: roles, fases, áreas, usuarios demo y relaciones creadas.');
}

(async () => {
  try {
    await main();
  } catch (e) {
    console.error('❌ Seed error:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
