import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, clasificacion_estado } from '@prisma/client';

// Asumo que estás en un servicio NestJS con this.prisma disponible.
// Ajusta nombres e imports según tu archivo real.
type clasificacion_estadoType = clasificacion_estado | null;

type RegistrarNotaDto = {
  idInscripcion: number;
  idEvaluador: number;
  nota: number;
  comentario?: string | null;
};

type EditarNotaDto = {
  idEvaluacion: number;
  idUsuario: number; // quien realiza la edición (para el log)
  idEvaluador?: number; // opcional, si se puede cambiar el evaluador
  nuevaNota: number;
  comentario?: string | null;
};

function calcularClasificacion(
  nota: number | null | undefined,
): clasificacion_estadoType {
  if (nota === null || nota === undefined) return null;
  if (nota === -1) return 'DESCALIFICADO';
  // Nota > 60 -> CLASIFICADO
  // Nota >= 0 and <= 60 -> NO_CLASIFICADO
  if (nota > 60) return 'CLASIFICADO';
  if (nota >= 0) return 'NO_CLASIFICADO';
  return null;
}
@Injectable()
export class EvaluacionesService {
  constructor(private readonly prisma: PrismaService) {}

  // 📝 Registrar una nueva nota (transacción)
  async registrarNota(dto: RegistrarNotaDto & { idFase: 1 | 2 }) {
    const { idInscripcion, idEvaluador, nota, comentario, idFase } = dto;

    // Recuperar la inscripción (valida existencia y permite usar area/nivel si es necesario)
    const inscripcion = await this.prisma.inscripciones.findUnique({
      where: { id_inscripcion: idInscripcion },
    });
    if (!inscripcion) {
      throw new NotFoundException('Inscripción no encontrada');
    }

    const clasificacion = calcularClasificacion(nota);
    const notaDecimal = new Prisma.Decimal(nota);
    const puntajeField =
      idFase === 1 ? 'puntaje_clasificacion' : 'puntaje_final';

    // Hacemos todo en una única transacción atómica correctamente:
    const result = await this.prisma.$transaction(async (prisma) => {
      // 1) crear evaluacion
      const nuevaEval = await prisma.evaluaciones.create({
        data: {
          id_inscripcion: idInscripcion,
          id_fase: idFase,
          id_evaluador: idEvaluador,
          nota: notaDecimal,
          fecha_registro: new Date(),
          estado_registro: 'BORRADOR',
          comentario: comentario ?? null,
        },
      });

      // 2) crear log de cambios
      await prisma.log_cambios_nota.create({
        data: {
          id_evaluacion: nuevaEval.id_evaluacion,
          id_usuario: idEvaluador, // el usuario que registra (evaluador)
          accion: 'REGISTRO',
          valor_anterior: null,
          valor_nuevo: notaDecimal,
          // ts por default
        },
      });

      // 3) actualizar inscripcion: puntaje_clasificacion y clasificacion

      const updateData: Prisma.inscripcionesUpdateInput = {
        [puntajeField]: notaDecimal,
        updated_at: new Date(),
      };

      if (idFase === 1) {
        updateData.clasificacion = clasificacion;
      }

      await prisma.inscripciones.update({
        where: { id_inscripcion: idInscripcion },
        data: updateData,
      });

      return nuevaEval;
    });

    return result;
  }

  // ✏️ Editar una nota (transacción, agrega log)
  async editarNota(dto: EditarNotaDto & { idFase: 1 | 2 }) {
    const { idEvaluacion, idUsuario, idEvaluador, nuevaNota, comentario } = dto;

    const evaluacion = await this.prisma.evaluaciones.findUnique({
      where: { id_evaluacion: idEvaluacion },
    });
    if (!evaluacion) throw new NotFoundException('Evaluación no encontrada');

    const notaAnterior = evaluacion.nota;

    // Calculamos la nueva clasificación para la inscripción relacionada
    // Necesitamos el id_inscripcion (está en la evaluación)
    const idInscripcion = evaluacion.id_inscripcion;
    const nuevaClasificacion = calcularClasificacion(nuevaNota);
    const nuevaNotaDecimal = new Prisma.Decimal(nuevaNota);
    const puntajeField =
      evaluacion.id_fase === 1 ? 'puntaje_clasificacion' : 'puntaje_final';

    const actualizada = await this.prisma.$transaction(async (prisma) => {
      // 1) actualizar evaluacion
      const evalActualizada = await prisma.evaluaciones.update({
        where: { id_evaluacion: idEvaluacion },
        data: {
          id_evaluador: idEvaluador ?? evaluacion.id_evaluador,
          nota: nuevaNotaDecimal,
          fecha_registro: new Date(),
          comentario: comentario ?? evaluacion.comentario,
        },
      });

      // 2) crear log con datos
      await prisma.log_cambios_nota.create({
        data: {
          id_evaluacion: idEvaluacion,
          id_usuario: idUsuario,
          accion: 'MODIFICACION',
          valor_anterior: notaAnterior as unknown as Prisma.Decimal,
          valor_nuevo: nuevaNotaDecimal,
        },
      });

      // 3) actualizar inscripción
      const updateData: Prisma.inscripcionesUpdateInput = {
        [puntajeField]: nuevaNotaDecimal,
        updated_at: new Date(),
      };

      // Solo actualizar clasificación si es fase 1
      if (evaluacion.id_fase === 1) {
        updateData.clasificacion = nuevaClasificacion;
      }

      await prisma.inscripciones.update({
        where: { id_inscripcion: idInscripcion },
        data: updateData,
      });

      return evalActualizada;
    });

    return actualizada;
  }

  // Obtener logs (ya lo tenías; lo mantengo)
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
