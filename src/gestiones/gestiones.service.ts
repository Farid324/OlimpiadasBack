// /src/gestiones/gestiones.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  estado_gestion,
  estado_validacion,
  tipo_area_config,
  gestiones,
  areas_gestion,
  tipo_premio,
  Prisma,
} from '@prisma/client';

// ===================== TIPOS =====================

type AreaGestionHistorial = {
  id_area_gestion: number;
  id_gestion: number;
  nombre_area: string;
  nota_aprobacion: number | null;
  tipo: tipo_area_config;
  niveles_target: string | null;
  archived_at: Date;
};

type GestionConAreas = {
  id_gestion: number;
  anio: number;
  nombre: string | null;
  estado: estado_gestion;
  closed_at: Date | null;
  areas: AreaGestionHistorial[];
};

type GestionCerradaMetadata = {
  id_gestion: number;
  anio: number;
  nombre: string | null;
  closed_at: Date | null;
  total_areas: number;
};

type CloseGestionResult = {
  gestion: gestiones;
  areasArchivadas: number;
};

type GestionWithAreas = gestiones & {
  areas_gestion: areas_gestion[];
};

// ===================== NUEVOS TIPOS =====================

type OlimpistaRowDto = {
  id: number;
  nombreCompleto: string;
  area: string;
  nivel: string;
  puntuacion: number | null;
  unidadEducativa: string;
  departamento: string;
};

type OlimpistaFinalistaRowDto = OlimpistaRowDto & {
  medalla: tipo_premio | null;
};

type OlimpistasHistorialParams = {
  area?: string;
  q?: string;
};

@Injectable()
export class GestionesService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentOpenGestion(): Promise<gestiones | null> {
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: estado_gestion.ABIERTA },
      orderBy: { created_at: 'desc' },
    });
    return gestion ?? null;
  }

  async listAll(): Promise<gestiones[]> {
    return this.prisma.gestiones.findMany({
      orderBy: [{ anio: 'desc' }, { created_at: 'desc' }],
    });
  }

  async getCloseEligibility(): Promise<{
    canClose: boolean;
    reason: string | null;
    gestionId: number | null;
  }> {
    const current = await this.getCurrentOpenGestion();
    if (!current) {
      return {
        canClose: false,
        reason: 'No hay una gestión abierta actualmente.',
        gestionId: null,
      };
    }

    const faseClasif = await this.prisma.fases.findFirst({
      where: { nombre_fase: 'CLASIFICATORIA' },
      select: { id_fase: true },
    });
    const faseFinal = await this.prisma.fases.findFirst({
      where: { nombre_fase: 'FINAL' },
      select: { id_fase: true },
    });

    if (!faseClasif || !faseFinal) {
      return {
        canClose: false,
        reason:
          'No están configuradas correctamente las fases CLASIFICATORIA y FINAL.',
        gestionId: current.id_gestion,
      };
    }

    const [pendientesClasif, pendientesFinal, validClasif, validFinal] =
      await Promise.all([
        this.prisma.cierres_fase.count({
          where: {
            id_fase: faseClasif.id_fase,
            id_gestion: current.id_gestion,
            estado_validacion: { not: estado_validacion.VALIDADO },
          },
        }),
        this.prisma.cierres_fase.count({
          where: {
            id_fase: faseFinal.id_fase,
            id_gestion: current.id_gestion,
            estado_validacion: { not: estado_validacion.VALIDADO },
          },
        }),
        this.prisma.cierres_fase.count({
          where: {
            id_fase: faseClasif.id_fase,
            id_gestion: current.id_gestion,
            estado_validacion: estado_validacion.VALIDADO,
          },
        }),
        this.prisma.cierres_fase.count({
          where: {
            id_fase: faseFinal.id_fase,
            id_gestion: current.id_gestion,
            estado_validacion: estado_validacion.VALIDADO,
          },
        }),
      ]);

    if (validClasif === 0 || validFinal === 0) {
      return {
        canClose: false,
        reason:
          'No es posible cerrar la gestión: aún no hay cierres validados para ambas fases (clasificación y final).',
        gestionId: current.id_gestion,
      };
    }

    if (pendientesClasif > 0 || pendientesFinal > 0) {
      return {
        canClose: false,
        reason:
          'No es posible cerrar la gestión: existen cierres de fase pendientes o sin validar.',
        gestionId: current.id_gestion,
      };
    }

    return {
      canClose: true,
      reason: null,
      gestionId: current.id_gestion,
    };
  }

  /**
   * ===========================
   * MATERIALIZACIÓN PREMIADOS
   * ===========================
   */
  private async materializarPremiadosFinal(
    tx: Prisma.TransactionClient,
    idGestion: number,
  ): Promise<void> {
    const faseFinal = await tx.fases.findFirst({
      where: { nombre_fase: 'FINAL' },
      select: { id_fase: true },
    });
    if (!faseFinal) return;

    const configs = await tx.medallero_config.findMany({
      where: { id_gestion: idGestion },
      select: {
        id_area: true,
        id_nivel: true,
        oros: true,
        platas: true,
        bronces: true,
        menciones: true,
      },
    });

    if (configs.length === 0) return;

    // Idempotencia: borrar premios FINAL de esta gestión y recalcular
    await tx.premios_otorgados.deleteMany({
      where: { id_gestion: idGestion, fuente: 'FINAL' },
    });

    // resetear estado PREMIADO a FINALISTA para recalcular
    await tx.inscripciones.updateMany({
      where: { id_gestion: idGestion, estado_inscripcion: 'PREMIADO' },
      data: { estado_inscripcion: 'FINALISTA' },
    });

    for (const cfg of configs) {
      const oros = cfg.oros ?? 0;
      const platas = cfg.platas ?? 0;
      const bronces = cfg.bronces ?? 0;
      const menciones = cfg.menciones ?? 0;

      const total = oros + platas + bronces + menciones;
      if (total <= 0) continue;

      const elegibles = await tx.inscripciones.findMany({
        where: {
          id_gestion: idGestion,
          id_area: cfg.id_area,
          id_nivel: cfg.id_nivel,
          clasificacion: 'CLASIFICADO',
          puntaje_final: { not: null },
          evaluaciones: {
            some: {
              id_fase: faseFinal.id_fase,
              estado_registro: 'FIRMADA',
            },
          },
        },
        select: {
          id_inscripcion: true,
          puntaje_final: true,
          puntaje_clasificacion: true,
        },
        orderBy: [
          { puntaje_final: 'desc' },
          { puntaje_clasificacion: 'desc' },
          { id_inscripcion: 'asc' },
        ],
      });

      if (elegibles.length === 0) continue;

      const top = elegibles.slice(0, total);

      const asignaciones: Array<{ id_inscripcion: number; tipo: tipo_premio }> =
        [];
      let idx = 0;

      for (let i = 0; i < oros && idx < top.length; i++, idx++)
        asignaciones.push({
          id_inscripcion: top[idx].id_inscripcion,
          tipo: 'ORO',
        });

      for (let i = 0; i < platas && idx < top.length; i++, idx++)
        asignaciones.push({
          id_inscripcion: top[idx].id_inscripcion,
          tipo: 'PLATA',
        });

      for (let i = 0; i < bronces && idx < top.length; i++, idx++)
        asignaciones.push({
          id_inscripcion: top[idx].id_inscripcion,
          tipo: 'BRONCE',
        });

      for (let i = 0; i < menciones && idx < top.length; i++, idx++)
        asignaciones.push({
          id_inscripcion: top[idx].id_inscripcion,
          tipo: 'MENCION',
        });

      if (asignaciones.length === 0) continue;

      await tx.premios_otorgados.createMany({
        data: asignaciones.map((a) => ({
          id_gestion: idGestion,
          id_area: cfg.id_area,
          id_nivel: cfg.id_nivel,
          id_inscripcion: a.id_inscripcion,
          tipo: a.tipo,
          fuente: 'FINAL',
        })),
      });

      await tx.inscripciones.updateMany({
        where: {
          id_gestion: idGestion,
          id_inscripcion: { in: asignaciones.map((a) => a.id_inscripcion) },
        },
        data: {
          estado_inscripcion: 'PREMIADO',
          updated_at: new Date(),
        },
      });
    }
  }

  async closeCurrentGestion(): Promise<CloseGestionResult> {
    const current = await this.getCurrentOpenGestion();
    if (!current) {
      throw new BadRequestException('No hay una gestión abierta para cerrar.');
    }

    const eligibility = await this.getCloseEligibility();
    if (!eligibility.canClose) {
      throw new BadRequestException(
        eligibility.reason ??
          'No se cumplen las condiciones para cerrar la gestión.',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // ✅ MATERIALIZAR PREMIADOS ANTES DE CERRAR
      await this.materializarPremiadosFinal(tx, current.id_gestion);

      const areasActivas = await tx.areas.findMany({
        where: { activo: true },
        select: {
          nombre_area: true,
          nota_aprobacion: true,
          tipo: true,
          niveles_target: true,
        },
      });

      if (areasActivas.length > 0) {
        const areasToArchive = areasActivas.map((area) => ({
          id_gestion: current.id_gestion,
          nombre_area: area.nombre_area,
          nota_aprobacion: area.nota_aprobacion,
          tipo: area.tipo ?? tipo_area_config.INDIVIDUAL,
          niveles_target: area.niveles_target,
        }));

        await tx.areas_gestion.createMany({
          data: areasToArchive,
        });
      }

      await tx.areas.updateMany({
        where: { activo: true },
        data: {
          activo: false,
          estado: 'EVALUANDO',
        },
      });

      const updatedGestion = await tx.gestiones.update({
        where: { id_gestion: current.id_gestion },
        data: {
          estado: estado_gestion.CERRADA,
          closed_at: new Date(),
        },
      });

      return {
        gestion: updatedGestion,
        areasArchivadas: areasActivas.length,
      };
    });

    return result;
  }

  async openNewGestion(anio: number, nombre?: string): Promise<gestiones> {
    const existingOpen = await this.getCurrentOpenGestion();
    if (existingOpen) {
      throw new BadRequestException(
        'Ya existe una gestión abierta. Debes cerrarla antes de iniciar una nueva.',
      );
    }

    const gestion = await this.prisma.gestiones.create({
      data: {
        anio,
        nombre: nombre?.trim() || null,
        estado: estado_gestion.ABIERTA,
      },
    });

    return gestion;
  }

  async getAreasHistorial(): Promise<GestionConAreas[]> {
    const gestionesCerradas: GestionWithAreas[] =
      await this.prisma.gestiones.findMany({
        where: { estado: estado_gestion.CERRADA },
        orderBy: [{ anio: 'desc' }, { closed_at: 'desc' }],
        include: {
          areas_gestion: {
            orderBy: { nombre_area: 'asc' },
          },
        },
      });

    return gestionesCerradas.map((gestion: GestionWithAreas) => ({
      id_gestion: gestion.id_gestion,
      anio: gestion.anio,
      nombre: gestion.nombre,
      estado: gestion.estado,
      closed_at: gestion.closed_at,
      areas: gestion.areas_gestion.map((area: areas_gestion) => ({
        id_area_gestion: area.id_area_gestion,
        id_gestion: area.id_gestion,
        nombre_area: area.nombre_area,
        nota_aprobacion: area.nota_aprobacion,
        tipo: area.tipo,
        niveles_target: area.niveles_target,
        archived_at: area.archived_at,
      })),
    }));
  }

  async getAreasByGestion(idGestion: number): Promise<AreaGestionHistorial[]> {
    const areas: areas_gestion[] = await this.prisma.areas_gestion.findMany({
      where: { id_gestion: idGestion },
      orderBy: { nombre_area: 'asc' },
    });

    return areas.map((area: areas_gestion) => ({
      id_area_gestion: area.id_area_gestion,
      id_gestion: area.id_gestion,
      nombre_area: area.nombre_area,
      nota_aprobacion: area.nota_aprobacion,
      tipo: area.tipo,
      niveles_target: area.niveles_target,
      archived_at: area.archived_at,
    }));
  }

  async getGestionesCerradas(): Promise<GestionCerradaMetadata[]> {
    const gestiones = await this.prisma.gestiones.findMany({
      where: { estado: estado_gestion.CERRADA },
      orderBy: [{ anio: 'desc' }, { closed_at: 'desc' }],
      select: {
        id_gestion: true,
        anio: true,
        nombre: true,
        closed_at: true,
        _count: {
          select: { areas_gestion: true },
        },
      },
    });

    return gestiones.map((g) => ({
      id_gestion: g.id_gestion,
      anio: g.anio,
      nombre: g.nombre,
      closed_at: g.closed_at,
      total_areas: g._count.areas_gestion,
    }));
  }

  // ===================== HISTORIAL OLIMPISTAS =====================

  async getOlimpistasByGestionCerrada(
    idGestion: number,
    params: OlimpistasHistorialParams,
  ): Promise<OlimpistaRowDto[]> {
    const gestion = await this.prisma.gestiones.findUnique({
      where: { id_gestion: idGestion },
      select: { estado: true },
    });

    if (!gestion || gestion.estado !== estado_gestion.CERRADA) return [];

    const { area, q } = params ?? {};

    const where: Prisma.inscripcionesWhereInput = {
      id_gestion: idGestion,
      ...(area
        ? { area: { nombre_area: { equals: area, mode: 'insensitive' } } }
        : {}),
      ...(q
        ? {
            OR: [
              { competidor: { nombres: { contains: q, mode: 'insensitive' } } },
              {
                competidor: { apellidos: { contains: q, mode: 'insensitive' } },
              },
              { competidor: { escuela: { contains: q, mode: 'insensitive' } } },
              {
                competidor: {
                  departamento: { contains: q, mode: 'insensitive' },
                },
              },
              { competidor: { ci: { contains: q, mode: 'insensitive' } } },
              { area: { nombre_area: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const insc = await this.prisma.inscripciones.findMany({
      where,
      include: {
        competidor: true,
        area: true,
        nivel: true,
        evaluaciones: { select: { nota: true } },
      },
      orderBy: { id_inscripcion: 'desc' },
    });

    return insc.map((it) => {
      const manual =
        it.puntaje_clasificacion !== null &&
        it.puntaje_clasificacion !== undefined
          ? Number(it.puntaje_clasificacion)
          : null;

      const avg =
        (manual === null || manual === undefined) && it.evaluaciones.length
          ? it.evaluaciones.reduce((s, e) => s + Number(e.nota), 0) /
            it.evaluaciones.length
          : null;

      const puntuacion = manual ?? avg ?? null;

      return {
        id: it.id_inscripcion,
        nombreCompleto:
          `${it.competidor.nombres} ${it.competidor.apellidos}`.trim(),
        area: it.area.nombre_area,
        nivel: it.nivel.nombre_nivel,
        puntuacion,
        unidadEducativa: it.competidor.escuela ?? '',
        departamento: it.competidor.departamento ?? '',
      };
    });
  }

  /**
   * ✅ CLASIFICADOS por gestión cerrada (TAB CLASIFICADOS)
   * - clasificacion = 'CLASIFICADO'
   * - orden por puntaje_clasificacion desc
   */
  async getOlimpistasClasificadosByGestionCerrada(
    idGestion: number,
    params: OlimpistasHistorialParams,
  ): Promise<OlimpistaRowDto[]> {
    const gestion = await this.prisma.gestiones.findUnique({
      where: { id_gestion: idGestion },
      select: { estado: true },
    });

    if (!gestion || gestion.estado !== estado_gestion.CERRADA) return [];

    const { area, q } = params ?? {};

    const where: Prisma.inscripcionesWhereInput = {
      id_gestion: idGestion,
      clasificacion: 'CLASIFICADO',
      ...(area
        ? { area: { nombre_area: { equals: area, mode: 'insensitive' } } }
        : {}),
      ...(q
        ? {
            OR: [
              { competidor: { nombres: { contains: q, mode: 'insensitive' } } },
              {
                competidor: { apellidos: { contains: q, mode: 'insensitive' } },
              },
              { competidor: { escuela: { contains: q, mode: 'insensitive' } } },
              {
                competidor: {
                  departamento: { contains: q, mode: 'insensitive' },
                },
              },
              { competidor: { ci: { contains: q, mode: 'insensitive' } } },
              { area: { nombre_area: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const insc = await this.prisma.inscripciones.findMany({
      where,
      include: {
        competidor: true,
        area: true,
        nivel: true,
        evaluaciones: { select: { nota: true } },
      },
      orderBy: [{ puntaje_clasificacion: 'desc' }, { id_inscripcion: 'desc' }],
    });

    return insc.map((it) => {
      const manual =
        it.puntaje_clasificacion !== null &&
        it.puntaje_clasificacion !== undefined
          ? Number(it.puntaje_clasificacion)
          : null;

      const avg =
        (manual === null || manual === undefined) && it.evaluaciones.length
          ? it.evaluaciones.reduce((s, e) => s + Number(e.nota), 0) /
            it.evaluaciones.length
          : null;

      const puntuacion = manual ?? avg ?? null;

      return {
        id: it.id_inscripcion,
        nombreCompleto:
          `${it.competidor.nombres} ${it.competidor.apellidos}`.trim(),
        area: it.area.nombre_area,
        nivel: it.nivel.nombre_nivel,
        puntuacion,
        unidadEducativa: it.competidor.escuela ?? '',
        departamento: it.competidor.departamento ?? '',
      };
    });
  }

  /**
   * ✅ FINALISTAS por gestión cerrada (TAB FINALISTAS) + medalla materializada
   * - incluye quienes tengan evaluación FINAL FIRMADA o estado FINALISTA/PREMIADO
   * - añade medalla desde premios_otorgados (fuente FINAL)
   * - orden por puntaje_final desc
   */
  async getOlimpistasFinalistasByGestionCerrada(
    idGestion: number,
    params: OlimpistasHistorialParams,
  ): Promise<OlimpistaFinalistaRowDto[]> {
    const gestion = await this.prisma.gestiones.findUnique({
      where: { id_gestion: idGestion },
      select: { estado: true },
    });

    if (!gestion || gestion.estado !== estado_gestion.CERRADA) return [];

    const { area, q } = params ?? {};

    const faseFinal = await this.prisma.fases.findFirst({
      where: { nombre_fase: 'FINAL' },
      select: { id_fase: true },
    });
    if (!faseFinal) return [];

    // Premios materializados al cerrar gestión
    const premios = await this.prisma.premios_otorgados.findMany({
      where: { id_gestion: idGestion, fuente: 'FINAL' },
      select: { id_inscripcion: true, tipo: true },
    });

    const medallaByInsc = new Map<number, tipo_premio>();
    for (const p of premios) {
      if (p?.id_inscripcion && p?.tipo)
        medallaByInsc.set(p.id_inscripcion, p.tipo);
    }

    const where: Prisma.inscripcionesWhereInput = {
      id_gestion: idGestion,
      ...(area
        ? { area: { nombre_area: { equals: area, mode: 'insensitive' } } }
        : {}),
      ...(q
        ? {
            OR: [
              { competidor: { nombres: { contains: q, mode: 'insensitive' } } },
              {
                competidor: { apellidos: { contains: q, mode: 'insensitive' } },
              },
              { competidor: { escuela: { contains: q, mode: 'insensitive' } } },
              {
                competidor: {
                  departamento: { contains: q, mode: 'insensitive' },
                },
              },
              { competidor: { ci: { contains: q, mode: 'insensitive' } } },
              { area: { nombre_area: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
      OR: [
        {
          evaluaciones: {
            some: {
              id_fase: faseFinal.id_fase,
              estado_registro: 'FIRMADA',
            },
          },
        },
        { estado_inscripcion: 'FINALISTA' },
        { estado_inscripcion: 'PREMIADO' },
      ],
    };

    const insc = await this.prisma.inscripciones.findMany({
      where,
      include: {
        competidor: true,
        area: true,
        nivel: true,
        evaluaciones: { select: { nota: true, id_fase: true } },
      },
      orderBy: [
        { puntaje_final: 'desc' },
        { puntaje_clasificacion: 'desc' },
        { id_inscripcion: 'asc' },
      ],
    });

    return insc.map((it) => {
      const pf =
        it.puntaje_final !== null && it.puntaje_final !== undefined
          ? Number(it.puntaje_final)
          : null;

      const pc =
        it.puntaje_clasificacion !== null &&
        it.puntaje_clasificacion !== undefined
          ? Number(it.puntaje_clasificacion)
          : null;

      // si no hay puntaje_final, usamos promedio de evaluaciones como fallback
      const avg =
        (pf === null || pf === undefined) && it.evaluaciones.length
          ? it.evaluaciones.reduce((s, e) => s + Number(e.nota), 0) /
            it.evaluaciones.length
          : null;

      const puntuacion = pf ?? pc ?? avg ?? null;

      return {
        id: it.id_inscripcion,
        nombreCompleto:
          `${it.competidor.nombres} ${it.competidor.apellidos}`.trim(),
        area: it.area.nombre_area,
        nivel: it.nivel.nombre_nivel,
        puntuacion,
        unidadEducativa: it.competidor.escuela ?? '',
        departamento: it.competidor.departamento ?? '',
        medalla: medallaByInsc.get(it.id_inscripcion) ?? null,
      };
    });
  }

  async getAreasDisponiblesDeGestionCerrada(
    idGestion: number,
  ): Promise<string[]> {
    const gestion = await this.prisma.gestiones.findUnique({
      where: { id_gestion: idGestion },
      select: { estado: true },
    });

    if (!gestion || gestion.estado !== estado_gestion.CERRADA) return [];

    const rows = await this.prisma.inscripciones.findMany({
      where: { id_gestion: idGestion },
      select: { area: { select: { nombre_area: true } } },
      distinct: ['id_area'],
      orderBy: { area: { nombre_area: 'asc' } },
    });

    return rows.map((r) => r.area.nombre_area);
  }

  // ===================== TU CÓDIGO EXISTENTE: EQUIPO ACADÉMICO =====================

  async getEquipoGestionActual(): Promise<{
    gestion: gestiones | null;
    responsables: {
      id_responsable_area: number;
      activo: boolean;
      usuario: {
        id_usuario: number;
        nombre: string;
        apellido: string;
        correo: string;
        telefono: string | null;
        experiencia: number | null;
        especialidad: string | null;
        institucion: string | null;
        ci: string | null;
      };
      area: {
        id_area: number;
        nombre_area: string;
      };
    }[];
    evaluadores: {
      id_usuario: number;
      nombre: string;
      apellido: string;
      correo: string;
      telefono: string | null;
      institucion: string | null;
      especialidad: string | null;
      experiencia: number | null;
      activo: boolean;
      evaluadores_area: {
        area: {
          id_area: number;
          nombre_area: string;
        };
      }[];
    }[];
  }> {
    const gestion = await this.getCurrentOpenGestion();

    if (!gestion) {
      return {
        gestion: null,
        responsables: [],
        evaluadores: [],
      };
    }

    const [responsablesRaw, evaluadoresRaw] = await this.prisma.$transaction([
      this.prisma.responsables_area.findMany({
        where: {
          id_gestion: gestion.id_gestion,
          activo: true,
        },
        include: {
          usuario: true,
          area: true,
        },
        orderBy: {
          id_responsable_area: 'asc',
        },
      }),
      this.prisma.evaluadores_area.findMany({
        where: {
          id_gestion: gestion.id_gestion,
          activo: true,
          usuario: {
            rol: { nombre: 'EVALUADOR' },
          },
        },
        include: {
          usuario: true,
          area: true,
        },
        orderBy: {
          id_usuario: 'asc',
        },
      }),
    ]);

    const responsables = responsablesRaw.map((r) => ({
      id_responsable_area: r.id_responsable_area,
      activo: r.activo,
      usuario: {
        id_usuario: r.usuario.id_usuario,
        nombre: r.usuario.nombre,
        apellido: r.usuario.apellido,
        correo: r.usuario.correo,
        telefono: r.usuario.telefono ?? null,
        experiencia: r.usuario.experiencia ?? null,
        especialidad: r.usuario.especialidad ?? null,
        institucion: r.usuario.institucion ?? null,
        ci: r.usuario.ci ?? null,
      },
      area: {
        id_area: r.area.id_area,
        nombre_area: r.area.nombre_area,
      },
    }));

    type EvaluadorEquipo = {
      id_usuario: number;
      nombre: string;
      apellido: string;
      correo: string;
      telefono: string | null;
      institucion: string | null;
      especialidad: string | null;
      experiencia: number | null;
      activo: boolean;
      evaluadores_area: {
        area: {
          id_area: number;
          nombre_area: string;
        };
      }[];
    };

    const evaluadoresMap = new Map<number, EvaluadorEquipo>();

    for (const row of evaluadoresRaw) {
      const u = row.usuario;
      if (!evaluadoresMap.has(u.id_usuario)) {
        evaluadoresMap.set(u.id_usuario, {
          id_usuario: u.id_usuario,
          nombre: u.nombre,
          apellido: u.apellido,
          correo: u.correo,
          telefono: u.telefono ?? null,
          institucion: u.institucion ?? null,
          especialidad: u.especialidad ?? null,
          experiencia: u.experiencia ?? null,
          activo: u.activo,
          evaluadores_area: [],
        });
      }
      const item = evaluadoresMap.get(u.id_usuario);
      if (item) {
        item.evaluadores_area.push({
          area: {
            id_area: row.area.id_area,
            nombre_area: row.area.nombre_area,
          },
        });
      }
    }

    const evaluadores = Array.from(evaluadoresMap.values());

    return {
      gestion,
      responsables,
      evaluadores,
    };
  }

  async getEquipoByGestionId(idGestion: number): Promise<{
    gestion: gestiones | null;
    responsables: {
      id_responsable_area: number;
      activo: boolean;
      usuario: {
        id_usuario: number;
        nombre: string;
        apellido: string;
        correo: string;
        telefono: string | null;
        experiencia: number | null;
        especialidad: string | null;
        institucion: string | null;
        ci: string | null;
      };
      area: {
        id_area: number;
        nombre_area: string;
      };
    }[];
    evaluadores: {
      id_usuario: number;
      nombre: string;
      apellido: string;
      correo: string;
      telefono: string | null;
      institucion: string | null;
      especialidad: string | null;
      experiencia: number | null;
      activo: boolean;
      evaluadores_area: {
        area: {
          id_area: number;
          nombre_area: string;
        };
      }[];
    }[];
  }> {
    const gestion = await this.prisma.gestiones.findUnique({
      where: { id_gestion: idGestion },
    });

    if (!gestion) {
      return { gestion: null, responsables: [], evaluadores: [] };
    }

    const [responsablesRaw, evaluadoresRaw] = await this.prisma.$transaction([
      this.prisma.responsables_area.findMany({
        where: { id_gestion: idGestion },
        include: { usuario: true, area: true },
        orderBy: { id_responsable_area: 'asc' },
      }),
      this.prisma.evaluadores_area.findMany({
        where: {
          id_gestion: idGestion,
          usuario: { rol: { nombre: 'EVALUADOR' } },
        },
        include: { usuario: true, area: true },
        orderBy: { id_usuario: 'asc' },
      }),
    ]);

    const responsables = responsablesRaw.map((r) => ({
      id_responsable_area: r.id_responsable_area,
      activo: r.activo,
      usuario: {
        id_usuario: r.usuario.id_usuario,
        nombre: r.usuario.nombre,
        apellido: r.usuario.apellido,
        correo: r.usuario.correo,
        telefono: r.usuario.telefono ?? null,
        experiencia: r.usuario.experiencia ?? null,
        especialidad: r.usuario.especialidad ?? null,
        institucion: r.usuario.institucion ?? null,
        ci: r.usuario.ci ?? null,
      },
      area: {
        id_area: r.area.id_area,
        nombre_area: r.area.nombre_area,
      },
    }));

    type EvalTmp = {
      id_usuario: number;
      nombre: string;
      apellido: string;
      correo: string;
      telefono: string | null;
      institucion: string | null;
      especialidad: string | null;
      experiencia: number | null;
      activo: boolean;
      evaluadores_area: {
        area: { id_area: number; nombre_area: string };
      }[];
    };

    const map = new Map<number, EvalTmp>();

    for (const row of evaluadoresRaw) {
      const u = row.usuario;
      if (!map.has(u.id_usuario)) {
        map.set(u.id_usuario, {
          id_usuario: u.id_usuario,
          nombre: u.nombre,
          apellido: u.apellido,
          correo: u.correo,
          telefono: u.telefono ?? null,
          institucion: u.institucion ?? null,
          especialidad: u.especialidad ?? null,
          experiencia: u.experiencia ?? null,
          activo: u.activo,
          evaluadores_area: [],
        });
      }
      map.get(u.id_usuario)!.evaluadores_area.push({
        area: {
          id_area: row.area.id_area,
          nombre_area: row.area.nombre_area,
        },
      });
    }

    return {
      gestion,
      responsables,
      evaluadores: Array.from(map.values()),
    };
  }
}
