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
  // ==========================================================
  // 1. GESTIÓN ACTIVA (CRUCIAL)
  // ==========================================================
  const anioActual = new Date().getFullYear();
  const nombreGestion = `Olimpiadas Científicas ${anioActual} - Demo`;

  // Asegurar la creación o actualización de la gestión activa
  const gestionActiva = await prisma.gestiones.upsert({
    where: {
      id_gestion: 1, // Intentamos usar un ID fijo para la primera gestión
    },
    update: {
      anio: anioActual,
      nombre: nombreGestion,
      estado: 'ABIERTA',
    },
    create: {
      anio: anioActual,
      nombre: nombreGestion,
      estado: 'ABIERTA',
    },
  });

  const ID_GESTION_ACTIVA = gestionActiva.id_gestion;
  console.log(`✅ Gestión Activa: ${gestionActiva.nombre} (ID: ${ID_GESTION_ACTIVA})`);
  // ==========================================================
  // FIN GESTIÓN
  // ==========================================================


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
  const faseFinal = await prisma.fases.upsert({
    where: { nombre_fase: 'FINAL' },
    update: { orden_fase: 2 },
    create: { nombre_fase: 'FINAL', orden_fase: 2 },
  });
  if (!faseFinal) throw new Error('Fase FINAL no encontrada (seed).');


  // Áreas
  const areaMate = await prisma.areas.upsert({
    where: { nombre_area: 'Matemática' },
    update: { niveles_target: 'Secundaria,Primaria' },
    create: { nombre_area: 'Matemática', activo: true, niveles_target: 'Secundaria,Primaria' },
  });
  const areaFisica = await prisma.areas.upsert({
    where: { nombre_area: 'Física' },
    update: { niveles_target: 'Secundaria' },
    create: { nombre_area: 'Física', activo: true, niveles_target: 'Secundaria' },
  });

  // Admin
  const emailAdmin = process.env.ADMIN_EMAIL ?? 'admin@olimpiadas.edu';
  const passAdmin = process.env.ADMIN_PASSWORD ?? 'olimpiadas2024';
  const hashAdmin = await bcrypt.hash(passAdmin, 10);

  const adminUser = await prisma.usuarios.upsert({
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

  // ==========================================================
  // CORRECCIÓN: Agregar id_gestion a evaluadores_area
  // ==========================================================
  await prisma.evaluadores_area.createMany({
    data: [
      {
        id_usuario: evaluador.id_usuario,
        id_area: areaMate.id_area,
        id_gestion: ID_GESTION_ACTIVA, // <-- AGREGADO
        activo: true,
      },
      {
        id_usuario: evaluador.id_usuario,
        id_area: areaFisica.id_area,
        id_gestion: ID_GESTION_ACTIVA, // <-- AGREGADO
        activo: true,
      },
    ],
    skipDuplicates: true,
  });

  // ==========================================================
  // RESPONSABLES
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
    where: { 
      id_gestion: ID_GESTION_ACTIVA, 
      id_area: { in: [areaMate.id_area, areaFisica.id_area] } 
    },
  });

  // ==========================================================
  // CORRECCIÓN: Agregar id_gestion a responsables_area
  // ==========================================================
  await prisma.responsables_area.createMany({
    data: [
      {
        id_usuario: responsableMath.id_usuario,
        id_area: areaMate.id_area,
        id_gestion: ID_GESTION_ACTIVA, // <-- AGREGADO
        activo: true,
      },
      {
        id_usuario: responsablePhys.id_usuario,
        id_area: areaFisica.id_area,
        id_gestion: ID_GESTION_ACTIVA, // <-- AGREGADO
        activo: true,
      },
    ],
    skipDuplicates: true,
  });

  // ========================================================================
  // COMPETIDORES + INSCRIPCIONES DE EJEMPLO
  // (La limpieza previa a la creación es correcta)
  // ========================================================================

  // Limpieza previa
  const cisDePrueba = [
    'CI0001', 'CI0002', 'CI0003', 'CI0004', 'CI0005', 'CI0006', 'CI0007', 'CI0008',
  ];

  await prisma.inscripciones.deleteMany({
    where: {
      id_gestion: ID_GESTION_ACTIVA,
      competidor: { ci: { in: cisDePrueba } },
    },
  });
  // Nota: Dejar el deleteMany de competidores fuera de la gestión
  await prisma.competidores.deleteMany({
    where: { ci: { in: cisDePrueba } },
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

  const getId = (ci: string): number => {
    const competidor = compList.find((c) => c.ci === ci);
    if (!competidor) {
      throw new Error(
        `Error fatal en seed: No se pudo encontrar el competidor con CI ${ci} después de crearlo.`,
      );
    }
    return competidor.id_competidor;
  };
  const now = new Date();

  // ==========================================================
  // CORRECCIÓN: Agregar id_gestion a inscripciones
  // ==========================================================
  await prisma.inscripciones.createMany({
    data: [
      // Matemática / Secundaria
      {
        id_competidor: getId('CI0001'),
        id_area: areaMate.id_area,
        id_nivel: secundaria.id_nivel,
        id_gestion: ID_GESTION_ACTIVA, // <-- AGREGADO
        estado_inscripcion: 'INSCRITO',
        observaciones: null,
        created_at: now,
        updated_at: now,
      },
      {
        id_competidor: getId('CI0002'),
        id_area: areaMate.id_area,
        id_nivel: secundaria.id_nivel,
        id_gestion: ID_GESTION_ACTIVA, // <-- AGREGADO
        estado_inscripcion: 'INSCRITO',
        observaciones: null,
        created_at: now,
        updated_at: now,
      },
      {
        id_competidor: getId('CI0003'),
        id_area: areaMate.id_area,
        id_nivel: secundaria.id_nivel,
        id_gestion: ID_GESTION_ACTIVA, // <-- AGREGADO
        estado_inscripcion: 'INSCRITO',
        observaciones: null,
        created_at: now,
        updated_at: now,
      },
      {
        id_competidor: getId('CI0005'),
        id_area: areaMate.id_area,
        id_nivel: secundaria.id_nivel,
        id_gestion: ID_GESTION_ACTIVA, // <-- AGREGADO
        estado_inscripcion: 'INSCRITO',
        observaciones: null,
        created_at: now,
        updated_at: now,
      },
      {
        id_competidor: getId('CI0006'),
        id_area: areaMate.id_area,
        id_nivel: secundaria.id_nivel,
        id_gestion: ID_GESTION_ACTIVA, // <-- AGREGADO
        estado_inscripcion: 'INSCRITO',
        observaciones: null,
        created_at: now,
        updated_at: now,
      },
      {
        id_competidor: getId('CI0007'),
        id_area: areaMate.id_area,
        id_nivel: secundaria.id_nivel,
        id_gestion: ID_GESTION_ACTIVA, // <-- AGREGADO
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
        id_gestion: ID_GESTION_ACTIVA, // <-- AGREGADO
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
        id_gestion: ID_GESTION_ACTIVA, // <-- AGREGADO
        estado_inscripcion: 'INSCRITO',
        observaciones: null,
        created_at: now,
        updated_at: now,
      },
    ],
    skipDuplicates: true,
  });

  // ============================================================
  // EXTRA PARA PRUEBAS HU-16 (Descomentando y ajustando para la gestión)
  // ============================================================

  const inscMatSec = await prisma.inscripciones.findMany({
    where: { 
      id_area: areaMate.id_area, 
      id_nivel: secundaria.id_nivel, 
      id_gestion: ID_GESTION_ACTIVA 
    },
    select: { id_inscripcion: true },
  });

  // EVALUACIONES (DESCOMENTADAS Y CORREGIDAS PARA LA GESTIÓN)
  for (const it of inscMatSec) {
    await prisma.evaluaciones.upsert({
      where: {
        // La clave de unicidad uq_eval_unica no requiere id_gestion
        uq_eval_unica: {
          id_inscripcion: it.id_inscripcion,
          id_fase: faseFinal.id_fase,
          id_evaluador: evaluador.id_usuario,
        },
      },
      update: {
        nota: new Prisma.Decimal(80 + Math.random() * 20), // 80..100
        estado_registro: 'FIRMADA',
        comentario: 'Auto-seed FINAL (firmada)',
      },
      create: {
        id_inscripcion: it.id_inscripcion,
        id_fase: faseFinal.id_fase,
        id_evaluador: evaluador.id_usuario,
        nota: new Prisma.Decimal(80 + Math.random() * 20),
        estado_registro: 'FIRMADA',
        comentario: 'Auto-seed FINAL (firmada)',
      },
    });
  }

  // Creación de una inscripción con evaluación en BORRADOR (para pruebas)
  const inscFisSec = await prisma.inscripciones.findMany({
    where: { 
      id_area: areaFisica.id_area, 
      id_nivel: secundaria.id_nivel, 
      id_gestion: ID_GESTION_ACTIVA 
    },
    select: { id_inscripcion: true },
  });

  if (inscFisSec.length > 0) {
    const first = inscFisSec[0];
    await prisma.evaluaciones.upsert({
      where: {
        uq_eval_unica: {
          id_inscripcion: first.id_inscripcion,
          id_fase: faseFinal.id_fase,
          id_evaluador: evaluador.id_usuario,
        },
      },
      update: {
        nota: new Prisma.Decimal(60),
        estado_registro: 'BORRADOR',
        comentario: 'Pendiente a propósito para test HU-16',
      },
      create: {
        id_inscripcion: first.id_inscripcion,
        id_fase: faseFinal.id_fase,
        id_evaluador: evaluador.id_usuario,
        nota: new Prisma.Decimal(60),
        estado_registro: 'BORRADOR',
        comentario: 'Pendiente a propósito para test HU-16',
      },
    });
  }


  // ============================================================
  // PREMIOS PARA PRUEBAS DE CEREMONIA (DESCOMENTANDO Y AJUSTANDO)
  // ============================================================

  // helper: obtener id_inscripcion por CI/Área/Nivel/Gestión
  const inscByCiAreaNivelGestion = await prisma.inscripciones.findMany({
    where: {
      id_gestion: ID_GESTION_ACTIVA, // <-- AGREGADO
      id_area: { in: [areaMate.id_area, areaFisica.id_area] },
      id_nivel: { in: [primaria.id_nivel, secundaria.id_nivel] },
      competidor: { ci: { in: dataCompetidores.map(c => c.ci) } },
    },
    include: { competidor: true },
  });

  const getInscId = (ci: string, idArea: number, idNivel: number): number => {
    const insc = inscByCiAreaNivelGestion.find(
      i => 
        i.competidor?.ci === ci && 
        i.id_area === idArea && 
        i.id_nivel === idNivel && 
        i.id_gestion === ID_GESTION_ACTIVA
    );
    if (!insc) {
      throw new Error(
        `No se encontró la inscripción de ${ci} (area=${idArea}, nivel=${idNivel}, gestion=${ID_GESTION_ACTIVA}).`,
      );
    }
    return insc.id_inscripcion;
  };

  // limpiar premios de esta gestión para estos competidores 
  await prisma.premios_otorgados.deleteMany({
    where: {
      id_gestion: ID_GESTION_ACTIVA, // <-- CORREGIDO
      inscripcion: {
        id_competidor: { in: compList.map(c => c.id_competidor) },
      },
    },
  });

  // crear premios
  const premiosData: Prisma.premios_otorgadosCreateManyInput[] = [ // <-- Usamos el tipo correcto
    // Matemática / Secundaria
    {
      id_inscripcion: getInscId('CI0001', areaMate.id_area, secundaria.id_nivel),
      id_area: areaMate.id_area,
      id_nivel: secundaria.id_nivel,
      id_gestion: ID_GESTION_ACTIVA, // <-- AGREGADO
      anio: anioActual,
      tipo: tipo_premio.ORO,
      fuente: 'FINAL', // Corregido a enum
      generado_desde: null,
      creado_en: new Date(),
    },
    {
      id_inscripcion: getInscId('CI0002', areaMate.id_area, secundaria.id_nivel),
      id_area: areaMate.id_area,
      id_nivel: secundaria.id_nivel,
      id_gestion: ID_GESTION_ACTIVA, // <-- AGREGADO
      anio: anioActual,
      tipo: tipo_premio.PLATA,
      fuente: 'FINAL',
      generado_desde: null,
      creado_en: new Date(),
    },
    {
      id_inscripcion: getInscId('CI0003', areaMate.id_area, secundaria.id_nivel),
      id_area: areaMate.id_area,
      id_nivel: secundaria.id_nivel,
      id_gestion: ID_GESTION_ACTIVA, // <-- AGREGADO
      anio: anioActual,
      tipo: tipo_premio.BRONCE,
      fuente: 'FINAL',
      generado_desde: null,
      creado_en: new Date(),
    },

    // Física / Secundaria
    {
      id_inscripcion: getInscId('CI0004', areaFisica.id_area, secundaria.id_nivel),
      id_area: areaFisica.id_area,
      id_nivel: secundaria.id_nivel,
      id_gestion: ID_GESTION_ACTIVA, // <-- AGREGADO
      anio: anioActual,
      tipo: tipo_premio.MENCION,
      fuente: 'FINAL',
      generado_desde: null,
      creado_en: new Date(),
    },

    // Matemática / Primaria
    {
      id_inscripcion: getInscId('CI0008', areaMate.id_area, primaria.id_nivel),
      id_area: areaMate.id_area,
      id_nivel: primaria.id_nivel,
      id_gestion: ID_GESTION_ACTIVA, // <-- AGREGADO
      anio: anioActual,
      tipo: tipo_premio.ORO,
      fuente: 'FINAL',
      generado_desde: null,
      creado_en: new Date(),
    },
  ];

  await prisma.premios_otorgados.createMany({
    data: premiosData,
    skipDuplicates: true,
  });

  // (Opcional) marcamos esas inscripciones como PREMIADO
  await prisma.inscripciones.updateMany({
    where: { id_inscripcion: { in: premiosData.map(p => p.id_inscripcion) } },
    data: { estado_inscripcion: 'PREMIADO' },
  });

  // ========= NUEVO: poner Departamento y Unidad Educativa a los competidores (DESCOMENTADO) =========
  const patchCompetidores = [
    {
      ci: 'CI0001',
      departamento: 'Cochabamba',
      escuela: 'Unidad Educativa San Martín',
    },
    {
      ci: 'CI0002',
      departamento: 'Cochabamba',
      escuela: 'Colegio Técnico Bolívar',
    },
    {
      ci: 'CI0003',
      departamento: 'La Paz',
      escuela: 'Colegio Don Bosco',
    },
    {
      ci: 'CI0004',
      departamento: 'Santa Cruz',
      escuela: 'Unidad Educativa Cristo Rey',
    },
    {
      ci: 'CI0008',
      departamento: 'Cochabamba',
      escuela: 'Escuela Fiscal Simón Rodríguez',
    },
  ];

  for (const pc of patchCompetidores) {
    const comp = compList.find(c => c.ci === pc.ci);
    if (!comp) continue; // por si acaso

    await prisma.competidores.update({
      where: { id_competidor: comp.id_competidor },
      data: {
        departamento: pc.departamento,
        escuela: pc.escuela,
      },
    });
  }


  console.log('🏅 Premios de prueba creados para Ceremonia:', premiosData.length);
  console.log('📚 Departamentos y unidades educativas actualizados para:', patchCompetidores.length);
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