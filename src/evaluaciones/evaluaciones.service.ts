import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

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
    idAreas: number[];
    filtro?: 'PENDIENTE' | 'EVALUADO' | 'TODOS';
    id_area?: number;
    id_nivel?: number;
  }) {
    if (!Array.isArray(idAreas) || idAreas.length === 0) {
      return [];
    }
    if (!id_area || !id_nivel) {
      // Se requiere id_area e id_nivel para determinar el estado de la fase.
      // Si no están, devolvemos una lista vacía o manejamos un error.
      return [];
    }

    const areaWhere =
      typeof id_area === 'number' && id_area > 0 ? id_area : { in: idAreas };

    let filtroClasificacion: Prisma.inscripcionesWhereInput = {}; // 1. CONSULTAR EL ESTADO DE VALIDACIÓN DE LA FASE CLASIFICATORIA (ID 1)
    const cierreClasificatoria = await this.prisma.cierres_fase.findUnique({
      where: {
        uq_cierre_unico: { id_fase: 1, id_area: id_area, id_nivel: id_nivel },
      },
      select: { estado_validacion: true },
    });

    const isClasificatoriaValidada =
      cierreClasificatoria?.estado_validacion === 'VALIDADO'; // 2. APLICAR FILTRO: Si la Fase Clasificatoria está VALIDADA, estamos en Fase Final.

    if (isClasificatoriaValidada) {
      // En Fase Final, solo mostramos a los que CLASIFICARON
      filtroClasificacion = { clasificacion: 'CLASIFICADO' };
    } // 3. CALCULAR LA FASE ACTUAL para el filtro PENDIENTE/EVALUADO.
    // 💡 ESTA DECLARACIÓN DEBE ESTAR FUERA DEL OBJETO 'where'.
    const idFaseActual = isClasificatoriaValidada ? 2 : 1;

    return this.prisma.inscripciones.findMany({
      where: {
        id_area: areaWhere,
        ...(typeof id_nivel === 'number' && id_nivel > 0 ? { id_nivel } : {}),
        ...filtroClasificacion,

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
        // 4. USAR LA VARIABLE DENTRO DEL OBJETO
        ...(filtro === 'PENDIENTE'
          ? { evaluaciones: { none: { id_fase: idFaseActual } } }
          : filtro === 'EVALUADO'
            ? { evaluaciones: { some: { id_fase: idFaseActual } } }
            : {}),
      },
      select: {
        id_inscripcion: true,
        estado_inscripcion: true,
        area: { select: { nombre_area: true } },
        nivel: { select: { nombre_nivel: true } },
        clasificacion: true,
        puntaje_clasificacion: true,
        puntaje_final: true,
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
          where: { id_fase: idFaseActual },
          orderBy: { fecha_registro: 'desc' },
          take: 1,
          select: {
            id_evaluacion: true,
            nota: true,
            estado_registro: true,
          },
        },
      },
      orderBy: [{ id_area: 'asc' }, { id_nivel: 'asc' }],
    });
  }

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
