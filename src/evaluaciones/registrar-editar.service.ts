import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, clasificacion_estado } from '@prisma/client';

type clasificacion_estadoType = clasificacion_estado | null;

type RegistrarNotaDto = {
  idInscripcion: number;
  idEvaluador: number;
  nota: number;
  descripConceptual?: string | null;
  comentario?: string | null;
  idFase: 1 | 2;
};

type EditarNotaDto = {
  idEvaluacion: number;
  idUsuario: number;
  idEvaluador?: number;
  nuevaNota: number;
  descripConceptual?: string | null;
  comentario?: string | null;
  idFase: 1 | 2;
};

async function getArea(
  id_area: number,
  prisma: PrismaService | Prisma.TransactionClient,
): Promise<{
  nota_aprobacion: number | null;
  tipo: string | null;
  niveles_target: string | null;
} | null> {
  return prisma.areas.findUnique({
    where: { id_area },
    select: {
      nota_aprobacion: true,
      tipo: true,
      niveles_target: true,
    },
  });
}

function calcularClasificacionPorArea(
  nota: number | null | undefined,
  notaAprobacion: number | null | undefined,
): clasificacion_estadoType {
  if (nota === null || nota === undefined) return null;
  if (nota === -1) return 'DESCALIFICADO';

  const minimo = notaAprobacion ?? 0;

  if (nota >= minimo) return 'CLASIFICADO';
  if (nota >= 0) return 'NO_CLASIFICADO';

  return null;
}

@Injectable()
export class EvaluacionesService {
  constructor(private readonly prisma: PrismaService) {}

  async registrarNota(dto: RegistrarNotaDto) {
    const {
      idInscripcion,
      idEvaluador,
      nota,
      descripConceptual,
      comentario,
      idFase,
    } = dto;

    const inscripcion = await this.prisma.inscripciones.findUnique({
      where: { id_inscripcion: idInscripcion },
    });
    if (!inscripcion) throw new NotFoundException('Inscripción no encontrada');

    // ✔ obtener área real de la inscripción
    const area = await getArea(inscripcion.id_area, this.prisma);
    const notaAprobacion = area?.nota_aprobacion ?? 60;

    const clasificacion = calcularClasificacionPorArea(nota, notaAprobacion);
    const notaDecimal = new Prisma.Decimal(nota);
    const puntajeField =
      idFase === 1 ? 'puntaje_clasificacion' : 'puntaje_final';

    const result = await this.prisma.$transaction(async (tx) => {
      const nuevaEval = await tx.evaluaciones.create({
        data: {
          id_inscripcion: idInscripcion,
          id_fase: idFase,
          id_evaluador: idEvaluador,
          nota: notaDecimal,
          fecha_registro: new Date(),
          estado_registro: 'BORRADOR',
          descripConceptual: descripConceptual ?? null,
          comentario: comentario ?? null,
        },
      });

      await tx.log_cambios_nota.create({
        data: {
          id_evaluacion: nuevaEval.id_evaluacion,
          id_usuario: idEvaluador,
          accion: 'REGISTRO',
          valor_anterior: null,
          valor_nuevo: notaDecimal,
        },
      });

      const updateData: Prisma.inscripcionesUpdateInput = {
        [puntajeField]: notaDecimal,
        updated_at: new Date(),
      };

      if (idFase === 1) updateData.clasificacion = clasificacion;

      await tx.inscripciones.update({
        where: { id_inscripcion: idInscripcion },
        data: updateData,
      });

      return nuevaEval;
    });

    return result;
  }

  async editarNota(dto: EditarNotaDto) {
    const {
      idEvaluacion,
      idUsuario,
      idEvaluador,
      nuevaNota,
      descripConceptual,
      comentario,
    } = dto;

    const evaluacion = await this.prisma.evaluaciones.findUnique({
      where: { id_evaluacion: idEvaluacion },
    });
    if (!evaluacion) throw new NotFoundException('Evaluación no encontrada');

    const idInscripcion = evaluacion.id_inscripcion;

    const inscripcion = await this.prisma.inscripciones.findUnique({
      where: { id_inscripcion: idInscripcion },
    });
    if (!inscripcion) throw new NotFoundException('Inscripción no encontrada');

    const area = await getArea(inscripcion.id_area, this.prisma);
    const notaAprobacion = area?.nota_aprobacion ?? 60;

    const nuevaClasificacion = calcularClasificacionPorArea(
      nuevaNota,
      notaAprobacion,
    );

    const notaAnterior = evaluacion.nota;
    const nuevaNotaDecimal = new Prisma.Decimal(nuevaNota);

    const puntajeField =
      evaluacion.id_fase === 1 ? 'puntaje_clasificacion' : 'puntaje_final';

    const result = await this.prisma.$transaction(async (tx) => {
      const evalActualizada = await tx.evaluaciones.update({
        where: { id_evaluacion: idEvaluacion },
        data: {
          id_evaluador: idEvaluador ?? evaluacion.id_evaluador,
          nota: nuevaNotaDecimal,
          fecha_registro: new Date(),
          descripConceptual: descripConceptual ?? evaluacion.descripConceptual,
          comentario: comentario ?? evaluacion.comentario,
        },
      });

      await tx.log_cambios_nota.create({
        data: {
          id_evaluacion: idEvaluacion,
          id_usuario: idUsuario,
          accion: 'MODIFICACION',
          valor_anterior: notaAnterior as unknown as Prisma.Decimal,
          valor_nuevo: nuevaNotaDecimal,
        },
      });

      const updateData: Prisma.inscripcionesUpdateInput = {
        [puntajeField]: nuevaNotaDecimal,
        updated_at: new Date(),
      };

      if (evaluacion.id_fase === 1)
        updateData.clasificacion = nuevaClasificacion;

      await tx.inscripciones.update({
        where: { id_inscripcion: idInscripcion },
        data: updateData,
      });

      return evalActualizada;
    });

    return result;
  }
}
