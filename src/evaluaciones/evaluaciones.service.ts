import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EvaluacionesAdminService {
  constructor(public prisma: PrismaService) {}

  //Listar y buscar competidores con filtros
  async listarCompetidores({
    search,
    idAreas,
    filtro,
    id_area,
    id_nivel,
  }: {
    search?: string;
    idAreas: number[]; // áreas del evaluador (obligatorio)
    filtro?: 'PENDIENTE' | 'EVALUADO' | 'TODOS'; // tab
    id_area?: number; // filtro UI opcional
    id_nivel?: number; // filtro UI opcional
  }) {
    if (!Array.isArray(idAreas) || idAreas.length === 0) {
      return [];
    }

    // Si llega id_area se usa ese número; caso contrario, se limita a las áreas asignadas
    const areaWhere =
      typeof id_area === 'number' && id_area > 0 ? id_area : { in: idAreas };

    return this.prisma.inscripciones.findMany({
      where: {
        id_area: areaWhere,
        ...(typeof id_nivel === 'number' && id_nivel > 0 ? { id_nivel } : {}),
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
          orderBy: { fecha_registro: 'desc' },
          take: 1,
          select: {
            id_evaluacion: true,
            nota: true,
            estado_registro: true,
            comentario: true,
          },
        },
      },
      orderBy: [{ id_area: 'asc' }, { id_nivel: 'asc' }],
    });
  }
  async listarCompetidoresFirmados({
    search,
    idAreas,
    id_area,
    id_nivel,
  }: {
    search?: string;
    idAreas: number[]; // Áreas asignadas al evaluador (obligatorio)
    id_area?: number; // Filtro de área específico (opcional)
    id_nivel?: number; // Filtro de nivel específico (opcional)
  }) {
    // ⚠️ Si no hay áreas asignadas, no devuelve nada
    if (!Array.isArray(idAreas) || idAreas.length === 0) {
      return [];
    }

    // Si llega id_area, se usa ese número; caso contrario, se limita a las áreas asignadas
    const areaWhere =
      typeof id_area === 'number' && id_area > 0 ? id_area : { in: idAreas };

    return this.prisma.inscripciones.findMany({
      where: {
        id_area: areaWhere,
        clasificacion: 'CLASIFICADO', // ✅ solo competidores clasificados
        ...(typeof id_nivel === 'number' && id_nivel > 0 ? { id_nivel } : {}),

        // ✅ solo inscripciones con al menos una evaluación firmada
        evaluaciones: {
          some: { estado_registro: 'FIRMADA' },
        },

        // ✅ búsqueda flexible por nombre, apellidos, ci o escuela
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
        // ✅ solo muestra la última evaluación firmada
        evaluaciones: {
          where: {
            estado_registro: 'FIRMADA',
            id_fase: 2,
          },
          orderBy: { fecha_registro: 'desc' },
          take: 1,
          select: {
            id_evaluacion: true,
            nota: true,
            estado_registro: true,
            comentario: true,
          },
        },
      },
      orderBy: [{ id_area: 'asc' }, { id_nivel: 'asc' }],
    });
  }

  // ====== el resto queda igual ======
  async registrarNota({
    idInscripcion,
    idEvaluador,
    nota,
  }: {
    idInscripcion: number;
    idEvaluador: number;
    nota: number;
  }) {
    const inscripcion = await this.prisma.inscripciones.findUnique({
      where: { id_inscripcion: idInscripcion },
    });
    if (!inscripcion) throw new NotFoundException('Inscripción no encontrada');

    return this.prisma.evaluaciones.create({
      data: {
        id_inscripcion: idInscripcion,
        id_fase: 1,
        id_evaluador: idEvaluador,
        nota,
        estado_registro: 'FIRMADA',
      },
    });
  }

  async editarNota({
    idEvaluacion,
    idUsuario,
    nuevaNota,
  }: {
    idEvaluacion: number;
    idUsuario: number;
    nuevaNota: number;
  }) {
    const evaluacion = await this.prisma.evaluaciones.findUnique({
      where: { id_evaluacion: idEvaluacion },
    });
    if (!evaluacion) throw new NotFoundException('Evaluación no encontrada');

    const notaAnterior = evaluacion.nota;

    const actualizada = await this.prisma.evaluaciones.update({
      where: { id_evaluacion: idEvaluacion },
      data: { nota: nuevaNota },
    });

    await this.prisma.log_cambios_nota.create({
      data: {
        id_evaluacion: idEvaluacion,
        id_usuario: idUsuario,
        accion: 'MODIFICACION',
        valor_anterior: notaAnterior,
        valor_nuevo: nuevaNota,
      },
    });

    return actualizada;
  }

  async getResumenEvaluador(idEvaluador: number) {
    const areasAsignadas = await this.prisma.evaluadores_area.findMany({
      where: { id_usuario: idEvaluador, activo: true },
      select: { id_area: true },
    });
    const areaIds = areasAsignadas.map((a) => a.id_area);

    if (areaIds.length === 0) {
      return { total: 0, pendientes: 0, evaluados: 0, clasificados: 0 };
    }

    const total = await this.prisma.inscripciones.count({
      where: { id_area: { in: areaIds } },
    });

    const pendientes = await this.prisma.inscripciones.count({
      where: {
        id_area: { in: areaIds },
        evaluaciones: { none: { id_evaluador: idEvaluador } },
      },
    });

    const evaluados = await this.prisma.inscripciones.count({
      where: {
        id_area: { in: areaIds },
        evaluaciones: { some: { id_evaluador: idEvaluador } },
      },
    });

    const clasificados = await this.prisma.inscripciones.count({
      where: { id_area: { in: areaIds }, clasificacion: 'CLASIFICADO' },
    });

    return { total, pendientes, evaluados, clasificados };
  }
}
