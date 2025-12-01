// prisma/seed.ts
import 'dotenv/config';
import {
  PrismaClient,
  ciclo_nivel,
  tipo_premio,
  fuente_lista,
  Prisma,
} from '@prisma/client';
//import { tipo_premio} from '@prisma/client';
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

  // Niveles
  const primaria = await prisma.niveles.upsert({
    where: { nombre_nivel: 'Primaria' },
    update: {},
    create: { nombre_nivel: 'Primaria', orden: 1 },
  });
  const secundaria = await prisma.niveles.upsert({
    where: { nombre_nivel: 'Secundaria' },
    update: {},
    create: { nombre_nivel: 'Secundaria', orden: 2 },
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

  // Áreas
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
  // ===================== GESTIÓN =====================
  const gestionActual = await prisma.gestiones.create({
    data: {
      anio: 2025,
      nombre: 'Olimpiadas 2025',
      estado: 'ABIERTA',
    },
  });
  console.log('✅ Gestión creada con ID:', gestionActual.id_gestion);

  // Admin
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

  // Evaluador demo
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

  await prisma.evaluadores_area.createMany({
    data: [
      {
        id_usuario: evaluador.id_usuario,
        id_area: areaMate.id_area,
        id_gestion: gestionActual.id_gestion, // <--- AGREGAR ESTO
        activo: true,
      },
      {
        id_usuario: evaluador.id_usuario,
        id_area: areaFisica.id_area,
        id_gestion: gestionActual.id_gestion, // <--- AGREGAR ESTO
        activo: true,
      },
    ],
    skipDuplicates: true,
  });

  // ==========================================================
  //             RESPONSABLES: 2 usuarios distintos para HU-08
  // ==========================================================
  // Ana Martínez -> Matemática
  const respMathEmail =
    process.env.RESP_MATH_EMAIL ?? 'resp.math@olimpiadas.edu';
  const respMathPass = process.env.RESP_MATH_PASSWORD ?? 'olimpiadas2024';
  const respMathHash = await bcrypt.hash(respMathPass, 10);

  const responsableMath = await prisma.usuarios.upsert({
    where: { correo: respMathEmail },
    update: {
      hash_password: respMathHash,
      id_rol: respRole.id_rol,
      activo: true,
      nombre: 'Ana',
      apellido: 'Martínez',
    },
    create: {
      correo: respMathEmail,
      hash_password: respMathHash,
      nombre: 'Ana',
      apellido: 'Martínez',
      id_rol: respRole.id_rol,
      activo: true,
      institucion: 'Instituto Tecnológico',
      especialidad: 'Matemática',
      experiencia: 10,
      telefono: '78987654',
    },
  });

  // Luis Herrera -> Física
  const respPhysEmail =
    process.env.RESP_PHYS_EMAIL ?? 'resp.phys@olimpiadas.edu';
  const respPhysPass = process.env.RESP_PHYS_PASSWORD ?? 'olimpiadas2024';
  const respPhysHash = await bcrypt.hash(respPhysPass, 10);

  const responsablePhys = await prisma.usuarios.upsert({
    where: { correo: respPhysEmail },
    update: {
      hash_password: respPhysHash,
      id_rol: respRole.id_rol,
      activo: true,
      nombre: 'Luis',
      apellido: 'Herrera',
    },
    create: {
      correo: respPhysEmail,
      hash_password: respPhysHash,
      nombre: 'Luis',
      apellido: 'Herrera',
      id_rol: respRole.id_rol,
      activo: true,
      institucion: 'UMSS',
      especialidad: 'Física Teórica',
      experiencia: 9,
      telefono: '70876543',
    },
  });

  // Limpieza de asociaciones previas en estas áreas (por si re-seedeas)
  await prisma.responsables_area.deleteMany({
    where: { id_area: { in: [areaMate.id_area, areaFisica.id_area] } },
  });

  // Asociaciones correctas (uno por área)
  await prisma.responsables_area.createMany({
    data: [
      {
        id_usuario: responsableMath.id_usuario,
        id_area: areaMate.id_area,
        id_gestion: gestionActual.id_gestion, // <--- AGREGAR ESTO
        activo: true,
      },
      {
        id_usuario: responsablePhys.id_usuario,
        id_area: areaFisica.id_area,
        id_gestion: gestionActual.id_gestion, // <--- AGREGAR ESTO
        activo: true,
      },
    ],
    skipDuplicates: true,
  });

  // ========================================================================
  // NUEVA SECCIÓN: COMPETIDORES + INSCRIPCIONES DE EJEMPLO
  // ========================================================================

  // Limpieza previa
  await prisma.inscripciones.deleteMany({
    where: {
      competidor: {
        ci: {
          in: [
            'CI0001',
            'CI0002',
            'CI0003',
            'CI0004',
            'CI0005',
            'CI0006',
            'CI0007',
            'CI0008',
          ],
        },
      },
    },
  });
  await prisma.competidores.deleteMany({
    where: {
      ci: {
        in: [
          'CI0001',
          'CI0002',
          'CI0003',
          'CI0004',
          'CI0005',
          'CI0006',
          'CI0007',
          'CI0008',
        ],
      },
    },
  });

  // Insertar competidores
  const dataCompetidores = [
    {
      nombres: 'María',
      apellidos: 'González López',
      ci: 'CI0001',
      escuela: 'Colegio San Andrés',
      departamento: 'La Paz',
      nivel: ciclo_nivel.SECUNDARIA,
    },
    {
      nombres: 'Carlos',
      apellidos: 'Mamani Quispe',
      ci: 'CI0002',
      escuela: 'Unidad Educativa Nacional',
      departamento: 'Cochabamba',
      nivel: ciclo_nivel.SECUNDARIA,
    },
    {
      nombres: 'Ana',
      apellidos: 'Silva Torrez',
      ci: 'CI0003',
      escuela: 'Colegio Bolívar',
      departamento: 'Santa Cruz',
      nivel: ciclo_nivel.SECUNDARIA,
    },
    {
      nombres: 'Pedro',
      apellidos: 'Vargas Nina',
      ci: 'CI0004',
      escuela: 'Colegio Técnico',
      departamento: 'La Paz',
      nivel: ciclo_nivel.SECUNDARIA,
    },
    {
      nombres: 'Lucía',
      apellidos: 'Rojas Pérez',
      ci: 'CI0005',
      escuela: 'Colegio 6 de Agosto',
      departamento: 'Oruro',
      nivel: ciclo_nivel.SECUNDARIA,
    },
    {
      nombres: 'Jaime',
      apellidos: 'Ortega Cruz',
      ci: 'CI0006',
      escuela: 'Colegio Don Bosco',
      departamento: 'Tarija',
      nivel: ciclo_nivel.SECUNDARIA,
    },
    {
      nombres: 'Sonia',
      apellidos: 'Medina Flores',
      ci: 'CI0007',
      escuela: 'Colegio Marista',
      departamento: 'La Paz',
      nivel: ciclo_nivel.SECUNDARIA,
    },
    {
      nombres: 'Diego',
      apellidos: 'Álvarez Soto',
      ci: 'CI0008',
      escuela: 'Esc. Manuela Gandarillas',
      departamento: 'Cochabamba',
      nivel: ciclo_nivel.PRIMARIA,
    },
  ];

  await prisma.competidores.createMany({
    data: dataCompetidores,
    skipDuplicates: true,
  });
  const compList = await prisma.competidores.findMany({
    where: { ci: { in: dataCompetidores.map((c) => c.ci) } },
  });

  const getId = (ci: string) => {
    const competidor = compList.find((c) => c.ci === ci);
    if (!competidor) {
      // Si esto pasa, algo salió muy mal (la creación o la búsqueda falló)
      throw new Error(
        `Error fatal en seed: No se pudo encontrar el competidor con CI ${ci} después de crearlo.`,
      );
    }
    return competidor.id_competidor; // Esto ahora es 'number' (no undefined)
  };
  const now = new Date();

  await prisma.inscripciones.createMany({
    data: [
      // Matemática / Secundaria
      {
        id_competidor: getId('CI0001'),
        id_area: areaMate.id_area,
        id_nivel: secundaria.id_nivel,
        id_gestion: gestionActual.id_gestion, // ✅ Agregado
        estado_inscripcion: 'INSCRITO',
        observaciones: null,
        created_at: now,
        updated_at: now,
      },
      {
        id_competidor: getId('CI0002'),
        id_area: areaMate.id_area,
        id_nivel: secundaria.id_nivel,
        id_gestion: gestionActual.id_gestion, // ✅ Agregado
        estado_inscripcion: 'INSCRITO',
        observaciones: null,
        created_at: now,
        updated_at: now,
      },
      {
        id_competidor: getId('CI0003'),
        id_area: areaMate.id_area,
        id_nivel: secundaria.id_nivel,
        id_gestion: gestionActual.id_gestion, // ✅ Agregado
        estado_inscripcion: 'INSCRITO',
        observaciones: null,
        created_at: now,
        updated_at: now,
      },
      {
        id_competidor: getId('CI0005'),
        id_area: areaMate.id_area,
        id_nivel: secundaria.id_nivel,
        id_gestion: gestionActual.id_gestion, // ✅ Agregado
        estado_inscripcion: 'INSCRITO',
        observaciones: null,
        created_at: now,
        updated_at: now,
      },
      {
        id_competidor: getId('CI0006'),
        id_area: areaMate.id_area,
        id_nivel: secundaria.id_nivel,
        id_gestion: gestionActual.id_gestion, // ✅ Agregado
        estado_inscripcion: 'INSCRITO',
        observaciones: null,
        created_at: now,
        updated_at: now,
      },
      {
        id_competidor: getId('CI0007'),
        id_area: areaMate.id_area,
        id_nivel: secundaria.id_nivel,
        id_gestion: gestionActual.id_gestion, // ✅ Agregado
        estado_inscripcion: 'INSCRITO',
        observaciones: null,
        created_at: now,
        updated_at: now,
      },
      // Física / Secundaria
      {
        id_competidor: getId('CI0004'),
        id_area: areaFisica.id_area,
        id_nivel: secundaria.id_nivel,
        id_gestion: gestionActual.id_gestion, // ✅ Agregado
        estado_inscripcion: 'INSCRITO',
        observaciones: null,
        created_at: now,
        updated_at: now,
      },
      // Matemática / Primaria
      {
        id_competidor: getId('CI0008'),
        id_area: areaMate.id_area,
        id_nivel: primaria.id_nivel,
        id_gestion: gestionActual.id_gestion, // ✅ Agregado
        estado_inscripcion: 'INSCRITO',
        observaciones: null,
        created_at: now,
        updated_at: now,
      },
    ],
    skipDuplicates: true,
  });

  // ============================================================
  // EXTRA PARA PRUEBAS HU-16
  // ============================================================

  const faseFinal = await prisma.fases.findUnique({
    where: { nombre_fase: 'FINAL' },
    select: { id_fase: true },
  });
  if (!faseFinal) throw new Error('Fase FINAL no encontrada (seed).');

  console.log('✅ Seed OK: competidores e inscripciones cargados.');
}

(async () => {
  try {
    await main();
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
