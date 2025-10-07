// prisma/seed.ts
import 'dotenv/config'; // ← asegura que carguen ADMIN_EMAIL, etc. al ejecutar con tsx
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Roles
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

  // Evaluador (demo)
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
      {
        id_usuario: evaluador.id_usuario,
        id_area: areaMate.id_area,
        activo: true,
      },
      {
        id_usuario: evaluador.id_usuario,
        id_area: areaFisica.id_area,
        activo: true,
      },
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

  console.log('Seed completado (roles, fases, admin, evaluador, responsable).');

  // DEMO ÁREAS
  const areasNombres = [
    'Matemática',
    'Física',
    'Química',
    'Biología',
    'Lenguaje',
  ];
  for (const nombre of areasNombres) {
    await prisma.areas.upsert({
      where: { nombre_area: nombre },
      update: { activo: true },
      create: { nombre_area: nombre, activo: true },
    });
  }

  // DEMO NIVELES
  const nivelesNombres = [
    '1ºP',
    '2ºP',
    '3ºP',
    '4ºP',
    '5ºP',
    '6ºP',
    '1ºS',
    '2ºS',
    '3ºS',
    '4ºS',
    '5ºS',
    '6ºS',
  ];

  // Orden sugerido: 1..12
  for (let i = 0; i < nivelesNombres.length; i++) {
    const nombre_nivel = nivelesNombres[i];
    await prisma.niveles.upsert({
      where: { nombre_nivel },
      update: { orden: i + 1 },
      create: { nombre_nivel, orden: i + 1 },
    });
  }

  console.log('Seed de áreas y niveles completado.');
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
