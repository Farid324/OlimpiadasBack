// src/evaluaciones/evaluaciones.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminEvaluacionesService {
  constructor(private readonly prisma: PrismaService) {}
  async listarEvaluacionesYInscripciones({
    areaId,
    nivelId,
    search,
    limit = 100,
    page = 1,
  }: {
    areaId?: number;
    nivelId?: number;
    search?: string;
    limit?: number;
    page?: number;
  }) {
    const whereInscripciones: Prisma.inscripcionesWhereInput = {};
    if (areaId) whereInscripciones.id_area = Number(areaId);
    if (nivelId) whereInscripciones.id_nivel = Number(nivelId);

    // búsqueda en campos del competidor
    if (search) {
      whereInscripciones.OR = [
        { competidor: { nombres: { contains: search, mode: 'insensitive' } } },
        {
          competidor: { apellidos: { contains: search, mode: 'insensitive' } },
        },
        { competidor: { ci: { contains: search, mode: 'insensitive' } } },
        { competidor: { escuela: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const items = await this.prisma.inscripciones.findMany({
      where: whereInscripciones,
      include: {
        competidor: {
          select: {
            id_competidor: true,
            nombres: true,
            apellidos: true,
            ci: true,
            escuela: true,
          },
        },
        area: { select: { id_area: true, nombre_area: true } },
        nivel: { select: { id_nivel: true, nombre_nivel: true } },
        // traer evaluación más relevante (ejemplo: fase 1, la más reciente)
        evaluaciones: {
          where: { id_fase: 1 },
          orderBy: { fecha_registro: 'desc' },
          take: 1,
          select: {
            id_evaluacion: true,
            nota: true,
            fecha_registro: true,
            estado_registro: true,
            comentario: true,
            id_evaluador: true,
            evaluador: {
              select: { id_usuario: true, nombre: true, apellido: true },
            },
          },
        },
      },
      orderBy: { created_at: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // transformar a forma amigable para frontend
    return items.map((i) => ({
      id_inscripcion: i.id_inscripcion,
      competidor: i.competidor,
      area: i.area,
      nivel: i.nivel,
      evaluaciones: i.evaluaciones.map((ev) => ({
        id_evaluacion: ev.id_evaluacion,
        nota: ev.nota ? Number(ev.nota) : null,
        fecha_registro: ev.fecha_registro,
        estado_registro: ev.estado_registro,
        comentario: ev.comentario,
        evaluador: ev.evaluador
          ? {
              id: ev.evaluador.id_usuario,
              nombre: ev.evaluador.nombre,
              apellido: ev.evaluador.apellido,
            }
          : null,
      })),
    }));
  }
  async estadisticasPorAreaNivel(areaId?: number, nivelId?: number) {
    const baseWhere: Prisma.inscripcionesWhereInput = {};
    if (areaId) baseWhere.id_area = areaId;
    if (nivelId) baseWhere.id_nivel = nivelId;

    // total inscripciones (para ese area/nivel)
    const total = await this.prisma.inscripciones.count({ where: baseWhere });

    // evaluaciones completadas (registradas y FIRMADA)
    const completadas = await this.prisma.evaluaciones.count({
      where: {
        inscripcion: {
          id_area: areaId ?? undefined,
          id_nivel: nivelId ?? undefined,
        },
        estado_registro: 'FIRMADA',
        id_fase: 1,
      },
    });

    // en proceso -> evaluaciones con BORRADOR
    const enProceso = await this.prisma.evaluaciones.count({
      where: {
        inscripcion: {
          id_area: areaId ?? undefined,
          id_nivel: nivelId ?? undefined,
        },
        estado_registro: 'BORRADOR',
        id_fase: 1,
      },
    });

    // pendientes = total - (completadas + enProceso)  (inscripciones sin evaluacion)
    const evaluadasDistinct = await this.prisma.evaluaciones.aggregate({
      _count: { id_inscripcion: true },
      where: {
        inscripcion: {
          id_area: areaId ?? undefined,
          id_nivel: nivelId ?? undefined,
        },
        id_fase: 1,
      },
    });
    const evaluadasCount = Number(evaluadasDistinct._count.id_inscripcion || 0);
    const pendientes = Math.max(0, total - evaluadasCount);

    return { total, completadas, enProceso, pendientes };
  }
  async listarAreas() {
    return this.prisma.areas.findMany({
      where: { activo: true },
      orderBy: { nombre_area: 'asc' },
    });
  }
  async listarNiveles() {
    return this.prisma.niveles.findMany({ orderBy: { orden: 'asc' } });
  }
  async obtenerDetalleEvaluacion(idEvaluacion: number) {
    const ev = await this.prisma.evaluaciones.findUnique({
      where: { id_evaluacion: idEvaluacion },
      include: {
        inscripcion: {
          include: {
            competidor: true,
            area: true,
            nivel: true,
          },
        },
        evaluador: {
          select: { id_usuario: true, nombre: true, apellido: true },
        },
      },
    });
    if (!ev) throw new NotFoundException('Evaluacion no encontrada');
    return ev;
  }

  async listarEvaluacionesFaseFinal({
    areaId,
    nivelId,
    search,
    limit = 100,
    page = 1,
  }: {
    areaId?: number;
    nivelId?: number;
    search?: string;
    limit?: number;
    page?: number;
  }) {
    const whereInscripciones: Prisma.inscripcionesWhereInput = {
      clasificacion: 'CLASIFICADO',
      evaluaciones: {
        some: {
          id_fase: 1,
          estado_registro: 'FIRMADA',
        },
      },
    };

    if (areaId) whereInscripciones.id_area = Number(areaId);
    if (nivelId) whereInscripciones.id_nivel = Number(nivelId);

    if (search) {
      whereInscripciones.OR = [
        { competidor: { nombres: { contains: search, mode: 'insensitive' } } },
        {
          competidor: { apellidos: { contains: search, mode: 'insensitive' } },
        },
        { competidor: { ci: { contains: search, mode: 'insensitive' } } },
        { competidor: { escuela: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const items = await this.prisma.inscripciones.findMany({
      where: whereInscripciones,
      include: {
        competidor: {
          select: {
            id_competidor: true,
            nombres: true,
            apellidos: true,
            ci: true,
            escuela: true,
          },
        },
        area: { select: { id_area: true, nombre_area: true } },
        nivel: { select: { id_nivel: true, nombre_nivel: true } },
        // ✅ Solo incluir evaluaciones de fase 2 (Final)
        evaluaciones: {
          where: { id_fase: 2 },
          orderBy: { fecha_registro: 'desc' },
          take: 1,
          select: {
            id_evaluacion: true,
            nota: true,
            fecha_registro: true,
            estado_registro: true,
            comentario: true,
            id_evaluador: true,
            evaluador: {
              select: {
                id_usuario: true,
                nombre: true,
                apellido: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return items.map((i) => ({
      id_inscripcion: i.id_inscripcion,
      competidor: i.competidor,
      area: i.area,
      nivel: i.nivel,
      evaluaciones: i.evaluaciones.map((ev) => ({
        id_evaluacion: ev.id_evaluacion,
        nota: ev.nota ? Number(ev.nota) : null,
        fecha_registro: ev.fecha_registro,
        estado_registro: ev.estado_registro,
        comentario: ev.comentario,
        evaluador: ev.evaluador
          ? {
              id: ev.evaluador.id_usuario,
              nombre: ev.evaluador.nombre,
              apellido: ev.evaluador.apellido,
            }
          : null,
      })),
    }));
  }

  async estadisticasFinales(areaId?: number, nivelId?: number) {
    // 🔹 Filtro base: inscripciones clasificadas y con evaluación firmada en fase 1
    const baseWhere: Prisma.inscripcionesWhereInput = {
      clasificacion: 'CLASIFICADO',
      evaluaciones: {
        some: {
          id_fase: 1,
          estado_registro: 'FIRMADA',
        },
      },
    };

    if (areaId) baseWhere.id_area = areaId;
    if (nivelId) baseWhere.id_nivel = nivelId;

    // 🔸 Total de inscripciones válidas (clasificados con eval fase 1 firmada)
    const total = await this.prisma.inscripciones.count({
      where: baseWhere,
    });

    // 🔸 Evaluaciones completadas (fase 2 firmadas)
    const completadas = await this.prisma.evaluaciones.count({
      where: {
        id_fase: 2,
        estado_registro: 'FIRMADA',
        inscripcion: {
          ...baseWhere,
        },
      },
    });

    // 🔸 En proceso (fase 2 en borrador)
    const enProceso = await this.prisma.evaluaciones.count({
      where: {
        id_fase: 2,
        estado_registro: 'BORRADOR',
        inscripcion: {
          ...baseWhere,
        },
      },
    });

    // 🔸 Cuántas inscripciones ya tienen al menos una evaluación de fase 2 (en cualquier estado)
    const evaluadasFase2 = await this.prisma.evaluaciones.aggregate({
      _count: { id_inscripcion: true },
      where: {
        id_fase: 2,
        inscripcion: {
          ...baseWhere,
        },
      },
    });

    const evaluadasCount = Number(evaluadasFase2._count.id_inscripcion || 0);

    // 🔸 Pendientes = inscripciones válidas - las que ya tienen alguna evaluación en fase 2
    const pendientes = Math.max(0, total - evaluadasCount);

    return { total, completadas, enProceso, pendientes };
  }
  async obtenerDetalleEvaluacionFaseDos(idEvaluacion: number) {
    const ev = await this.prisma.evaluaciones.findUnique({
      where: { id_evaluacion: idEvaluacion },
      include: {
        inscripcion: {
          include: {
            competidor: true,
            area: true,
            nivel: true,
          },
        },
        evaluador: {
          select: { id_usuario: true, nombre: true, apellido: true },
        },
      },
    });

    // ⚠️ Validar existencia y fase
    if (!ev) {
      throw new NotFoundException('Evaluación no encontrada');
    }

    if (ev.id_fase !== 2) {
      throw new NotFoundException(
        'La evaluación no pertenece a la Fase Final (Fase 2)',
      );
    }

    return ev;
  }
}
