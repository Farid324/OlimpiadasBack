import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
//import { PhaseType } from '../fases/dto/close-phase.dto';
//import { PhaseStatus } from '../fases/fases.service';

export interface InscripcionRow {
  id_inscripcion: number;
  estado_inscripcion: string;
  clasificacion?: string | null; // Puede ser null
  area: { nombre_area: string };
  nivel: { nombre_nivel: string };
  competidor: {
    id_competidor: number;
    nombres: string;
    apellidos: string;
    ci: string;
    escuela: string | null;
    departamento: string | null;
  };
  evaluaciones: Array<{
    id_evaluacion: number;
    nota: any; // Prisma.Decimal, lo dejamos como any o unknown para no complicar imports
    comentario: string | null;
    id_fase: number;
    id_evaluador: number;
    estado_registro: string;
  }>;
}

interface ListarCompetidoresParams {
  evaluadorId: number;
  search?: string;
  idAreas: number[];
  filtro?: 'PENDIENTE' | 'EVALUADO' | 'TODOS';
  id_area?: number;
  id_nivel?: number;
}
@Injectable()
export class EvaluacionesAdminService {
  constructor(public prisma: PrismaService) {}

  async listarCompetidores(params: ListarCompetidoresParams) {
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' },
    });
    // Si no hay gestión, devolvemos vacío para no mezclar datos históricos
    if (!gestion) return [];
    const { evaluadorId, search, idAreas, filtro, id_area, id_nivel } = params;

    if (!idAreas || !Array.isArray(idAreas) || idAreas.length === 0) {
      console.warn('❗ Evaluador sin áreas asignadas. Lista vacía.');
      return [];
    }

    // Áreas que vamos a considerar realmente (si filtra por un área concreta)
    const areaIdsToUse =
      typeof id_area === 'number' && id_area > 0 && idAreas.includes(id_area)
        ? [id_area]
        : idAreas;

    // Id de la fase CLASIFICATORIA
    const faseClasif = await this.prisma.fases.findFirst({
      where: { nombre_fase: 'CLASIFICATORIA' },
    });
    const idFaseClasif = faseClasif?.id_fase;

    const resultadoGlobal: InscripcionRow[] = [];

    for (const areaId of areaIdsToUse) {
      // 1) Obtener TODAS las inscripciones base de esa área (clasificación)
      const inscripcionesArea = await this.prisma.inscripciones.findMany({
        where: {
          id_area: areaId,
          id_gestion: gestion.id_gestion,
          ...(id_nivel ? { id_nivel } : {}),

          competidor: {
            OR: search
              ? [
                  { nombres: { contains: search, mode: 'insensitive' } },
                  { apellidos: { contains: search, mode: 'insensitive' } },
                  { ci: { contains: search, mode: 'insensitive' } },
                  { escuela: { contains: search, mode: 'insensitive' } },
                ]
              : undefined,
          },

          ...(filtro === 'PENDIENTE'
            ? { evaluaciones: { none: {} } }
            : filtro === 'EVALUADO'
              ? { evaluaciones: { some: {} } }
              : {}),
        },

        select: {
          id_inscripcion: true,
          estado_inscripcion: true,
          area: { select: { nombre_area: true } },
          nivel: { select: { nombre_nivel: true } },
          clasificacion: true,

          competidor: {
            select: {
              id_competidor: true,
              nombres: true,
              apellidos: true,
              ci: true,
              escuela: true,
              departamento: true,
            },
          },

          evaluaciones: {
            where: { id_fase: 1 },
            orderBy: { fecha_registro: 'desc' },
            take: 1,
            select: {
              id_evaluacion: true,
              nota: true,
              comentario: true,
              id_fase: true,
              id_evaluador: true,
              estado_registro: true,
            },
          },
        },

        orderBy: [{ id_inscripcion: 'asc' }],
      });

      // Si no hay configuración de fases, devolvemos todo (comportamiento antiguo)
      if (!idFaseClasif) {
        resultadoGlobal.push(...inscripcionesArea);
        continue;
      }

      // 2) Obtener evaluadores del área
      const evaluadoresArea = await this.prisma.evaluadores_area.findMany({
        where: { id_area: areaId, activo: true },
        select: { id_evaluador_area: true, id_usuario: true },
        orderBy: { id_usuario: 'asc' },
      });

      if (!evaluadoresArea.length) {
        resultadoGlobal.push(...inscripcionesArea);
        continue;
      }

      const idsEvaluadoresArea = evaluadoresArea.map(
        (e) => e.id_evaluador_area,
      );

      // 3) Asignaciones para esta área y fase
      const asignaciones = await this.prisma.asignacion_evaluador_fase.findMany(
        {
          where: {
            id_fase: idFaseClasif,
            id_evaluador_area: { in: idsEvaluadoresArea },
          },
          select: {
            id_evaluador_area: true,
            cupo: true,
          },
        },
      );

      // Si no hay asignaciones, dejamos comportamiento antiguo (todos ven todo)
      if (!asignaciones.length) {
        resultadoGlobal.push(...inscripcionesArea);
        continue;
      }

      // 4) Construir lista ordenada de { id_usuario, cupo }
      const asignPorUsuario = evaluadoresArea
        .map((ea) => {
          const match = asignaciones.find(
            (a) => a.id_evaluador_area === ea.id_evaluador_area,
          );
          return {
            id_usuario: ea.id_usuario,
            cupo: match?.cupo ?? 0,
          };
        })
        .filter((a) => a.cupo > 0)
        .sort((a, b) => a.id_usuario - b.id_usuario);

      const totalCupo = asignPorUsuario.reduce((s, a) => s + a.cupo, 0);

      if (!asignPorUsuario.length || totalCupo === 0) {
        // No hay cupos válidos → nadie ve nada de esta área
        continue;
      }

      // 5) Calcular el rango (start-end) que le toca al evaluador logueado
      let offset = 0;
      let rangoActual: { start: number; end: number } | null = null;

      for (const asign of asignPorUsuario) {
        const start = offset;
        const end = offset + asign.cupo; // end es exclusivo

        if (asign.id_usuario === evaluadorId) {
          rangoActual = { start, end };
          break;
        }

        offset = end;
      }

      if (!rangoActual) {
        // Este evaluador no tiene cupo en esta área
        continue;
      }

      const { start, end } = rangoActual;
      const slice = inscripcionesArea.slice(start, end);

      resultadoGlobal.push(...slice);
    }

    // (Opcional) mantengo el orden por área/nivel
    resultadoGlobal.sort((a, b) => {
      const aArea = a.area?.nombre_area ?? '';
      const bArea = b.area?.nombre_area ?? '';
      if (aArea !== bArea) return aArea.localeCompare(bArea);

      const aNivel = a.nivel?.nombre_nivel ?? '';
      const bNivel = b.nivel?.nombre_nivel ?? '';
      return aNivel.localeCompare(bNivel);
    });

    return resultadoGlobal;
  }

  async getAreasAsignadasForSelect(evaluadorId: number) {
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' },
    });
    if (!gestion) return [];
    const areas = await this.prisma.evaluadores_area.findMany({
      where: {
        id_usuario: evaluadorId,
        id_gestion: gestion.id_gestion,
        activo: true,
        area: { activo: true },
      },
      select: {
        id_area: true,
        area: { select: { nombre_area: true } },
      },
      orderBy: { id_area: 'asc' },
    });

    return areas.map((a) => ({
      value: a.id_area,
      label: a.area.nombre_area,
    }));
  }
  async listarCompetidoresFirmados({
    evaluadorId,
    search,
    idAreas,
    id_area,
    id_nivel,
  }: {
    evaluadorId: number;
    search?: string;
    idAreas: number[];
    id_area?: number;
    id_nivel?: number;
  }) {
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' },
    });
    if (!gestion) return [];
    if (!Array.isArray(idAreas) || idAreas.length === 0) {
      console.warn('❗ Evaluador sin áreas asignadas. Lista vacía.');
      return [];
    }

    const areaIdsToUse =
      typeof id_area === 'number' && id_area > 0 && idAreas.includes(id_area)
        ? [id_area]
        : idAreas;

    // Id de la fase FINAL
    const faseFinal = await this.prisma.fases.findFirst({
      where: { nombre_fase: 'FINAL' },
    });
    const idFaseFinal = faseFinal?.id_fase;

    const resultadoGlobal: InscripcionRow[] = [];

    for (const areaId of areaIdsToUse) {
      // 1) Inscripciones de fase final (clasificados + firmados fase 1)
      const inscripcionesArea = await this.prisma.inscripciones.findMany({
        where: {
          id_area: areaId,
          id_gestion: gestion.id_gestion,
          clasificacion: 'CLASIFICADO',

          ...(typeof id_nivel === 'number' && id_nivel > 0 ? { id_nivel } : {}),

          evaluaciones: {
            some: {
              id_fase: 1,
              estado_registro: 'FIRMADA',
            },
          },

          competidor: search
            ? {
                OR: [
                  { nombres: { contains: search, mode: 'insensitive' } },
                  { apellidos: { contains: search, mode: 'insensitive' } },
                  { ci: { contains: search, mode: 'insensitive' } },
                  { escuela: { contains: search, mode: 'insensitive' } },
                ],
              }
            : undefined,
        },

        select: {
          id_inscripcion: true,
          estado_inscripcion: true,
          clasificacion: true,

          area: { select: { nombre_area: true } },
          nivel: { select: { nombre_nivel: true } },

          competidor: {
            select: {
              id_competidor: true,
              nombres: true,
              apellidos: true,
              ci: true,
              escuela: true,
              departamento: true,
            },
          },

          evaluaciones: {
            where: { id_fase: 2 },
            orderBy: { fecha_registro: 'desc' },
            take: 1,
            select: {
              id_evaluacion: true,
              nota: true,
              comentario: true,
              id_fase: true,
              id_evaluador: true,
              estado_registro: true,
            },
          },
        },

        orderBy: [{ id_inscripcion: 'asc' }],
      });

      if (!idFaseFinal) {
        resultadoGlobal.push(...inscripcionesArea);
        continue;
      }

      // 2) Evaluadores del área
      const evaluadoresArea = await this.prisma.evaluadores_area.findMany({
        where: { id_area: areaId, activo: true },
        select: { id_evaluador_area: true, id_usuario: true },
        orderBy: { id_usuario: 'asc' },
      });

      if (!evaluadoresArea.length) {
        resultadoGlobal.push(...inscripcionesArea);
        continue;
      }

      const idsEvaluadoresArea = evaluadoresArea.map(
        (e) => e.id_evaluador_area,
      );

      // 3) Asignaciones fase FINAL
      const asignaciones = await this.prisma.asignacion_evaluador_fase.findMany(
        {
          where: {
            id_fase: idFaseFinal,
            id_evaluador_area: { in: idsEvaluadoresArea },
          },
          select: {
            id_evaluador_area: true,
            cupo: true,
          },
        },
      );

      if (!asignaciones.length) {
        resultadoGlobal.push(...inscripcionesArea);
        continue;
      }

      const asignPorUsuario = evaluadoresArea
        .map((ea) => {
          const match = asignaciones.find(
            (a) => a.id_evaluador_area === ea.id_evaluador_area,
          );
          return {
            id_usuario: ea.id_usuario,
            cupo: match?.cupo ?? 0,
          };
        })
        .filter((a) => a.cupo > 0)
        .sort((a, b) => a.id_usuario - b.id_usuario);

      const totalCupo = asignPorUsuario.reduce((s, a) => s + a.cupo, 0);

      if (!asignPorUsuario.length || totalCupo === 0) {
        continue;
      }

      let offset = 0;
      let rangoActual: { start: number; end: number } | null = null;

      for (const asign of asignPorUsuario) {
        const start = offset;
        const end = offset + asign.cupo;

        if (asign.id_usuario === evaluadorId) {
          rangoActual = { start, end };
          break;
        }

        offset = end;
      }

      if (!rangoActual) {
        continue;
      }

      const { start, end } = rangoActual;
      const slice = inscripcionesArea.slice(start, end);

      resultadoGlobal.push(...slice);
    }

    resultadoGlobal.sort((a, b) => {
      const aArea = a.area?.nombre_area ?? '';
      const bArea = b.area?.nombre_area ?? '';
      if (aArea !== bArea) return aArea.localeCompare(bArea);

      const aNivel = a.nivel?.nombre_nivel ?? '';
      const bNivel = b.nivel?.nombre_nivel ?? '';
      return aNivel.localeCompare(bNivel);
    });

    return resultadoGlobal;
  }

  async getResumenEvaluador(idEvaluador: number, idFase: number) {
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' },
    });
    if (!gestion)
      return { total: 0, pendientes: 0, evaluados: 0, clasificados: 0 };
    // Obtener las áreas asignadas al evaluador
    const areasAsignadas = await this.prisma.evaluadores_area.findMany({
      where: {
        id_usuario: idEvaluador,
        id_gestion: gestion.id_gestion,
        activo: true,
      },
      select: { id_area: true },
    });

    const areaIds = areasAsignadas.map((a) => a.id_area);

    if (areaIds.length === 0) {
      return { total: 0, pendientes: 0, evaluados: 0, clasificados: 0 };
    }
    const commonWhere = {
      id_area: { in: areaIds },
      id_gestion: gestion.id_gestion,
    };
    //Cálculo de totales según la fase
    let total: number;
    let pendientes: number;
    let evaluados: number;
    let clasificados: number;

    if (idFase === 1) {
      //FASE CLASIFICATORIA
      total = await this.prisma.inscripciones.count({
        where: { id_area: { in: areaIds } },
      });

      pendientes = await this.prisma.inscripciones.count({
        where: {
          id_area: { in: areaIds },
          evaluaciones: {
            none: { id_fase: 1 },
          },
        },
      });

      evaluados = await this.prisma.inscripciones.count({
        where: {
          id_area: { in: areaIds },
          evaluaciones: {
            some: { id_fase: 1 },
          },
        },
      });

      clasificados = await this.prisma.inscripciones.count({
        where: {
          id_area: { in: areaIds },
          clasificacion: 'CLASIFICADO',
        },
      });
    } else {
      total = await this.prisma.inscripciones.count({
        where: {
          ...commonWhere,
          clasificacion: 'CLASIFICADO',
          evaluaciones: {
            some: {
              id_fase: 1,
              estado_registro: 'FIRMADA',
            },
          },
        },
      });
      pendientes = await this.prisma.inscripciones.count({
        where: {
          id_area: { in: areaIds },
          clasificacion: 'CLASIFICADO',
          evaluaciones: {
            some: {
              id_fase: 1,
              estado_registro: 'FIRMADA',
            },
            none: {
              id_fase: 2,
            },
          },
        },
      });
      evaluados = await this.prisma.inscripciones.count({
        where: {
          id_area: { in: areaIds },
          clasificacion: 'CLASIFICADO',
          evaluaciones: {
            some: {
              id_fase: 2,
            },
          },
        },
      });
      clasificados = 0;
    }

    return { total, pendientes, evaluados, clasificados };
  }
}
