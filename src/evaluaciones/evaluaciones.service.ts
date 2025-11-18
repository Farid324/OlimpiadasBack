import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
//import { PhaseType } from '../fases/dto/close-phase.dto';
//import { PhaseStatus } from '../fases/fases.service';

interface ListarCompetidoresParams {
  search?: string;
  idAreas: number[];
  filtro?: 'PENDIENTE' | 'EVALUADO' | 'TODOS';
  id_area?: number;
  id_nivel?: number;
}
@Injectable()
export class EvaluacionesAdminService {
  constructor(public prisma: PrismaService) {}

  //Listar y buscar competidores con filtros
  // async listarCompetidores({
  //   search,
  //   idAreas,
  //   filtro,
  //   id_area,
  //   id_nivel,
  // }: {
  //   search?: string;
  //   idAreas: number[]; // áreas del evaluador (obligatorio)
  //   filtro?: 'PENDIENTE' | 'EVALUADO' | 'TODOS'; // tab
  //   id_area?: number; // filtro UI opcional
  //   id_nivel?: number; // filtro UI opcional
  // }) {
  //   if (!Array.isArray(idAreas) || idAreas.length === 0) {
  //     return [];
  //   }

  //   // Si llega id_area se usa ese número; caso contrario, se limita a las áreas asignadas
  //   const areaWhere =
  //     typeof id_area === 'number' && id_area > 0 ? id_area : { in: idAreas };

  //   return this.prisma.inscripciones.findMany({
  //     where: {
  //       id_area: areaWhere,
  //       ...(typeof id_nivel === 'number' && id_nivel > 0 ? { id_nivel } : {}),
  //       competidor: {
  //         OR: search
  //           ? [
  //               { nombres: { contains: search, mode: 'insensitive' } },
  //               { apellidos: { contains: search, mode: 'insensitive' } },
  //               { ci: { contains: search, mode: 'insensitive' } },
  //               { escuela: { contains: search, mode: 'insensitive' } },
  //             ]
  //           : undefined,
  //       },
  //       ...(filtro === 'PENDIENTE'
  //         ? { evaluaciones: { none: {} } }
  //         : filtro === 'EVALUADO'
  //           ? { evaluaciones: { some: {} } }
  //           : {}),
  //     },
  //     select: {
  //       id_inscripcion: true,
  //       estado_inscripcion: true,
  //       area: { select: { nombre_area: true } },
  //       nivel: { select: { nombre_nivel: true } },
  //       clasificacion: true,
  //       competidor: {
  //         select: {
  //           id_competidor: true,
  //           nombres: true,
  //           apellidos: true,
  //           ci: true,
  //           escuela: true,
  //           departamento: true,
  //         },
  //       },
  //       evaluaciones: {
  //         orderBy: { fecha_registro: 'desc' },
  //         take: 1,
  //         select: {
  //           id_evaluacion: true, // 👈 ESTE CAMPO ES CRUCIAL
  //           nota: true,
  //           comentario: true,
  //           id_fase: true,
  //           id_evaluador: true,
  //           estado_registro: true,
  //         },
  //       },
  //     },
  //     orderBy: [{ id_area: 'asc' }, { id_nivel: 'asc' }],
  //   });
  // }
  // 👇 Define el tipo de parámetros (lo puedes mover a un dto si quieres)

  async listarCompetidores(params: ListarCompetidoresParams) {
    const { search, idAreas, filtro, id_area, id_nivel } = params;

    if (!idAreas || !Array.isArray(idAreas) || idAreas.length === 0) {
      console.warn('❗ Evaluador sin áreas asignadas. Lista vacía.');
      return [];
    }

    const areaWhere =
      id_area && id_area > 0 && idAreas.includes(id_area)
        ? id_area
        : { in: idAreas };

    return this.prisma.inscripciones.findMany({
      where: {
        id_area: areaWhere,

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

        // 🔍 Filtro por estado de evaluación
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

      orderBy: [{ id_area: 'asc' }, { id_nivel: 'asc' }],
    });
  }

  async getAreasAsignadasForSelect(evaluadorId: number) {
    const areas = await this.prisma.evaluadores_area.findMany({
      where: {
        id_usuario: evaluadorId,
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

  // async listarCompetidoresFirmados({
  //   search,
  //   idAreas,
  //   id_area,
  //   id_nivel,
  // }: {
  //   search?: string;
  //   idAreas: number[]; // Áreas asignadas al evaluador (obligatorio)
  //   id_area?: number; // Filtro de área específico (opcional)
  //   id_nivel?: number; // Filtro de nivel específico (opcional)
  // }) {
  //   // ⚠️ Si no hay áreas asignadas, no devuelve nada
  //   if (!Array.isArray(idAreas) || idAreas.length === 0) {
  //     return [];
  //   }

  //   // Si llega id_area, se usa ese número; caso contrario, se limita a las áreas asignadas
  //   const areaWhere =
  //     typeof id_area === 'number' && id_area > 0 ? id_area : { in: idAreas };

  //   return this.prisma.inscripciones.findMany({
  //     where: {
  //       id_area: areaWhere,
  //       clasificacion: 'CLASIFICADO', // ✅ solo competidores clasificados
  //       ...(typeof id_nivel === 'number' && id_nivel > 0 ? { id_nivel } : {}),

  //       // ✅ solo inscripciones con al menos una evaluación firmada
  //       evaluaciones: {
  //         some: {
  //           id_fase: 1,
  //           estado_registro: 'FIRMADA',
  //         },
  //       },

  //       ...(typeof id_nivel === 'number' && id_nivel > 0 ? { id_nivel } : {}),

  //       // ✅ búsqueda flexible por nombre, apellidos, ci o escuela
  //       competidor: search
  //         ? {
  //             OR: [
  //               { nombres: { contains: search, mode: 'insensitive' } },
  //               { apellidos: { contains: search, mode: 'insensitive' } },
  //               { ci: { contains: search, mode: 'insensitive' } },
  //               { escuela: { contains: search, mode: 'insensitive' } },
  //             ],
  //           }
  //         : undefined,
  //     },
  //     select: {
  //       id_inscripcion: true,
  //       estado_inscripcion: true,
  //       clasificacion: true,
  //       area: { select: { nombre_area: true } },
  //       nivel: { select: { nombre_nivel: true } },
  //       competidor: {
  //         select: {
  //           id_competidor: true,
  //           nombres: true,
  //           apellidos: true,
  //           ci: true,
  //           escuela: true,
  //           departamento: true,
  //         },
  //       },

  //       // ✅ Traemos las evaluaciones de FASE 2 (para mostrar/editar en la fase final)
  //       evaluaciones: {
  //         where: { id_fase: 2 },
  //         orderBy: { fecha_registro: 'desc' },
  //         take: 1,
  //         select: {
  //           id_evaluacion: true,
  //           nota: true,
  //           comentario: true,
  //           id_fase: true,
  //           id_evaluador: true,
  //           estado_registro: true,
  //         },
  //       },
  //     },
  //     orderBy: [{ id_area: 'asc' }, { id_nivel: 'asc' }],
  //   });
  // }
  // private async getFaseId(type: PhaseType): Promise<number> {
  //   const nombre_fase =
  //     type === PhaseType.CLASIFICACION ? 'CLASIFICATORIA' : 'FINAL';
  //   const fase = await this.prisma.fases.findFirst({
  //     where: { nombre_fase },
  //     select: { id_fase: true },
  //   });
  //   if (!fase)
  //     throw new BadRequestException('No se encontró la fase configurada.');
  //   return fase.id_fase;
  // }

  async getResumenEvaluador(idEvaluador: number, idFase: number) {
    // 1️⃣ Obtener las áreas asignadas al evaluador
    const areasAsignadas = await this.prisma.evaluadores_area.findMany({
      where: { id_usuario: idEvaluador, activo: true },
      select: { id_area: true },
    });

    const areaIds = areasAsignadas.map((a) => a.id_area);

    if (areaIds.length === 0) {
      return { total: 0, pendientes: 0, evaluados: 0, clasificados: 0 };
    }

    // 2️⃣ Cálculo de totales según la fase
    let total: number;
    let pendientes: number;
    let evaluados: number;
    let clasificados: number;

    if (idFase === 1) {
      // 🟦 FASE CLASIFICATORIA
      total = await this.prisma.inscripciones.count({
        where: { id_area: { in: areaIds } },
      });

      pendientes = await this.prisma.inscripciones.count({
        where: {
          id_area: { in: areaIds },
          evaluaciones: {
            none: { id_evaluador: idEvaluador, id_fase: 1 },
          },
        },
      });

      evaluados = await this.prisma.inscripciones.count({
        where: {
          id_area: { in: areaIds },
          evaluaciones: {
            some: { id_evaluador: idEvaluador, id_fase: 1 },
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
      // 🟩 FASE FINAL
      // Total: solo clasificados con evaluación firmada
      total = await this.prisma.inscripciones.count({
        where: {
          id_area: { in: areaIds },
          clasificacion: 'CLASIFICADO',
          evaluaciones: {
            some: {
              id_fase: 1,
              estado_registro: 'FIRMADA',
            },
          },
        },
      });

      // Pendientes: clasificados que aún no tienen evaluación FIRMADA
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
              id_evaluador: idEvaluador,
            },
          },
        },
      });

      // Evaluados: clasificados con evaluación FIRMADA en fase 2
      evaluados = await this.prisma.inscripciones.count({
        where: {
          id_area: { in: areaIds },
          clasificacion: 'CLASIFICADO',
          evaluaciones: {
            some: {
              id_fase: 2,
              id_evaluador: idEvaluador,
            },
          },
        },
      });

      // En fase final no contamos nuevos "clasificados"
      clasificados = 0;
    }

    return { total, pendientes, evaluados, clasificados };
  }
}
