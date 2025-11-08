import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, clasificacion_estado } from '@prisma/client';

type clasificacion_estadoType = clasificacion_estado | null;

type RegistrarNotaDto = {
  idInscripcion: number;
  idEvaluador: number;
  nota: number;
  comentario?: string | null;
};

type EditarNotaDto = {
  idEvaluacion: number;
  idUsuario: number;
  idEvaluador?: number;
  nuevaNota: number;
  comentario?: string | null;
};

function calcularClasificacion(
  nota: number | null | undefined,
): clasificacion_estadoType {
  if (nota === null || nota === undefined) return null;
  if (nota === -1) return 'DESCALIFICADO';
  if (nota > 60) return 'CLASIFICADO';
  if (nota >= 0) return 'NO_CLASIFICADO';
  return null;
}
@Injectable()
export class EvaluacionesService {
  constructor(private readonly prisma: PrismaService) {}

  async registrarNota(dto: RegistrarNotaDto) {
    const { idInscripcion, idEvaluador, nota, comentario } = dto;

    const inscripcion = await this.prisma.inscripciones.findUnique({
      where: { id_inscripcion: idInscripcion },
    });
    if (!inscripcion) {
      throw new NotFoundException('Inscripción no encontrada');
    }

    const clasificacion = calcularClasificacion(nota);
    const notaDecimal = new Prisma.Decimal(nota);

    const result = await this.prisma.$transaction(async (prisma) => {
      const nuevaEval = await prisma.evaluaciones.create({
        data: {
          id_inscripcion: idInscripcion,
          id_fase: 1,
          id_evaluador: idEvaluador,
          nota: notaDecimal,
          fecha_registro: new Date(),
          estado_registro: 'BORRADOR',
          comentario: comentario ?? null,
        },
      });

      await prisma.log_cambios_nota.create({
        data: {
          id_evaluacion: nuevaEval.id_evaluacion,
          id_usuario: idEvaluador,
          accion: 'REGISTRO',
          valor_anterior: null,
          valor_nuevo: notaDecimal,
        },
      });

      await prisma.inscripciones.update({
        where: { id_inscripcion: idInscripcion },
        data: {
          puntaje_clasificacion: notaDecimal,
          clasificacion: clasificacion,
          updated_at: new Date(),
        },
      });

      return nuevaEval;
    });

    return result;
  }

  async editarNota(dto: EditarNotaDto) {
    const { idEvaluacion, idUsuario, idEvaluador, nuevaNota, comentario } = dto;

    const evaluacion = await this.prisma.evaluaciones.findUnique({
      where: { id_evaluacion: idEvaluacion },
    });
    if (!evaluacion) throw new NotFoundException('Evaluación no encontrada');

    const notaAnterior = evaluacion.nota;

    const idInscripcion = evaluacion.id_inscripcion;
    const nuevaClasificacion = calcularClasificacion(nuevaNota);
    const nuevaNotaDecimal = new Prisma.Decimal(nuevaNota);

    const actualizada = await this.prisma.$transaction(async (prisma) => {
      const evalActualizada = await prisma.evaluaciones.update({
        where: { id_evaluacion: idEvaluacion },
        data: {
          id_evaluador: idEvaluador ?? evaluacion.id_evaluador,
          nota: nuevaNotaDecimal,
          fecha_registro: new Date(),
          comentario: comentario ?? evaluacion.comentario,
        },
      });

      await prisma.log_cambios_nota.create({
        data: {
          id_evaluacion: idEvaluacion,
          id_usuario: idUsuario,
          accion: 'MODIFICACION',
          valor_anterior: notaAnterior as unknown as Prisma.Decimal,
          valor_nuevo: nuevaNotaDecimal,
        },
      });

      await prisma.inscripciones.update({
        where: { id_inscripcion: idInscripcion },
        data: {
          puntaje_clasificacion: nuevaNotaDecimal,
          clasificacion: nuevaClasificacion,
          updated_at: new Date(),
        },
      });

      return evalActualizada;
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
}
