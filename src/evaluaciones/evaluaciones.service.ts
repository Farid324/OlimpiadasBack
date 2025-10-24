// src/evaluaciones-admin/evaluaciones-admin.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EvaluacionesAdminService {
  constructor(private prisma: PrismaService) {}

  async obtenerCompetidoresDeEvaluador(idEvaluador: number) {
    console.log('🔹 [SERVICIO] Evaluador autenticado:', idEvaluador);

    // 1️⃣ Obtener las áreas asignadas al evaluador
    const areasEvaluador = await this.prisma.evaluadores_area.findMany({
      where: { id_usuario: idEvaluador },
      select: { id_area: true },
    });
    console.log('🔹 [SERVICIO] ÁREAS DEL EVALUADOR:', areasEvaluador);

    const idAreas = areasEvaluador.map((a) => a.id_area);

    if (idAreas.length === 0) {
      console.log('⚠️ [SERVICIO] El evaluador no tiene áreas asignadas.');
      return [];
    }

    // 2️⃣ Buscar las inscripciones en esas áreas
    console.log('🔹 [SERVICIO] Buscando inscripciones en áreas:', idAreas);
    const inscripciones = await this.prisma.inscripciones.findMany({
      where: {
        id_area: { in: idAreas },
      },
      select: {
        id_inscripcion: true,
        competidor: {
          select: {
            id_competidor: true,
            nombres: true,
            apellidos: true,
            ci: true,
            escuela: true,
          },
        },
        area: {
          select: {
            id_area: true,
            nombre_area: true,
          },
        },
      },
    });

    console.log(
      '✅ [SERVICIO] Inscripciones encontradas:',
      inscripciones.length,
    );
    console.log('📋 [SERVICIO] Detalle de las inscripciones:', inscripciones);

    return inscripciones;
  }

  // 🔍 Listar y buscar competidores
  async listarCompetidores({
    search,
    idAreas,
    filtro,
  }: {
    search?: string;
    idAreas: number[];
    filtro?: 'PENDIENTE' | 'EVALUADO' | 'TODOS';
  }) {
    return this.prisma.inscripciones.findMany({
      where: {
        id_area: { in: idAreas },
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

  // 📝 Registrar una nueva nota
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
        id_fase: 1, // Ejemplo, si tenés fases separadas
        id_evaluador: idEvaluador,
        nota,
        estado_registro: 'FIRMADA',
      },
    });
  }

  // ✏️ Editar una nota (registrando log)
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
        accion: 'EDITAR',
        valor_anterior: notaAnterior,
        valor_nuevo: nuevaNota,
      },
    });

    return actualizada;
  }
  async obtenerLogsCambios(idEvaluacion: number) {
    return this.prisma.log_cambios_nota.findMany({
      where: { id_evaluacion: idEvaluacion },
      include: {
        usuario: {
          select: { id_usuario: true, nombre: true, apellido: true, rol: true },
        },
      },
      orderBy: { ts: 'desc' },
    });
  }
  async getResumenEvaluador(idEvaluador: number) {
    // 1️⃣ Obtener áreas donde el evaluador tiene asignaciones
    const areasAsignadas = await this.prisma.evaluadores_area.findMany({
      where: { id_usuario: idEvaluador, activo: true },
      select: { id_area: true },
    });
    const areaIds = areasAsignadas.map((a) => a.id_area);

    if (areaIds.length === 0) {
      return { total: 0, pendientes: 0, evaluados: 0, clasificados: 0 };
    }

    // 2️⃣ Total competidores en esas áreas
    const total = await this.prisma.competidores.count({
      where: {
        activo: true,
        inscripciones: {
          some: { id_area: { in: areaIds } },
        },
      },
    });

    // 3️⃣ Pendientes: evaluaciones sin nota
    const pendientes = await this.prisma.evaluaciones.count({
      where: {
        id_evaluador: idEvaluador,
        nota: { equals: undefined },
        inscripcion: {
          id_area: { in: areaIds },
        },
      },
    });

    // 4️⃣ Evaluados: con nota
    const evaluados = await this.prisma.evaluaciones.count({
      where: {
        id_evaluador: idEvaluador,
        nota: { not: { equals: undefined } },
        inscripcion: {
          id_area: { in: areaIds },
        },
      },
    });

    // 5️⃣ Clasificados (ejemplo: nota >= 60)
    const clasificados = await this.prisma.evaluaciones.count({
      where: {
        id_evaluador: idEvaluador,
        nota: { gte: 60 },
        inscripcion: {
          id_area: { in: areaIds },
        },
      },
    });

    return { total, pendientes, evaluados, clasificados };
  }
}
