import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, clasificacion_estado } from '@prisma/client';
import { FasesService } from './fases.service';

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

@Injectable()
export class EvaluacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fasesService: FasesService,
  ) {}

  /**
   * Obtiene el criterio de clasificación (nota mínima) para la fase, área y nivel.
   */
  private async getCriterioClasificacion(
    idArea: number,
    idNivel: number,
    idFase: number,
  ): Promise<number | null> {
    const criterio = await this.prisma.configuracion_fase.findUnique({
      where: {
        uq_criterio_unico: {
          id_fase: idFase,
          id_area: idArea,
          id_nivel: idNivel,
        },
      },
      select: { nota_minima_aprobacion: true },
    });

    // Devuelve el valor numérico o null si no se encuentra
    return criterio ? criterio.nota_minima_aprobacion.toNumber() : null;
  }

  /**
   * Calcula el estado de clasificación usando el criterio dinámico.
   * Solo relevante para la Fase Clasificatoria.
   */
  private async calcularClasificacion(
    nota: number | null | undefined,
    idArea: number,
    idNivel: number,
  ): Promise<clasificacion_estado | null> {
    if (nota === null || nota === undefined) return null;

    // Se asume que la Clasificatoria es la fase 1
    const notaMinima = await this.getCriterioClasificacion(idArea, idNivel, 1);

    if (notaMinima === null) {
      // Manejar el caso donde no hay criterio (ej: lanzar error o usar un valor por defecto)
      throw new BadRequestException(
        `No se ha definido la nota mínima de aprobación para esta área y nivel.`,
      );
    }

    // Lógica de clasificación:
    if (nota === -1) return 'DESCALIFICADO';
    if (nota >= notaMinima) return 'CLASIFICADO';
    if (nota >= 0) return 'NO_CLASIFICADO';

    return null;
  }

  async registrarNota(dto: RegistrarNotaDto, idFase: number) {
    const { idInscripcion, idEvaluador, nota, comentario } = dto;

    const inscripcion = await this.prisma.inscripciones.findUnique({
      where: { id_inscripcion: idInscripcion },
    });
    if (!inscripcion) {
      throw new NotFoundException('Inscripción no encontrada');
    }

    const { id_area, id_nivel } = inscripcion;

    // 🛑 VALIDACIÓN CLAVE: Asegurar que la fase esté abierta para edición
    await this.fasesService.assertPhaseIsOpen(id_area, id_nivel, idFase);

    const notaDecimal = new Prisma.Decimal(nota);

    const result = await this.prisma.$transaction(async (prisma) => {
      let clasificacion: clasificacion_estado | null = null;
      let inscripcionUpdateData: Prisma.inscripcionesUpdateInput = {};

      if (idFase === 1) {
        // Fase Clasificatoria
        // Asegurarse de que no estamos registrando clasificación cuando la fase ya pasó
        await this.assertCanEvaluateClasificacion(id_area, id_nivel);

        clasificacion = await this.calcularClasificacion(
          nota,
          id_area,
          id_nivel,
        );
        inscripcionUpdateData = {
          puntaje_clasificacion: notaDecimal,
          clasificacion: clasificacion,
          updated_at: new Date(),
        };
      } else if (idFase === 2) {
        // Fase Final
        // Opcional: Asegurar que el competidor esté clasificado para poder evaluarlo en la final
        if (inscripcion.clasificacion !== 'CLASIFICADO') {
          throw new ForbiddenException(
            'Solo se pueden evaluar competidores clasificados en la Fase Final.',
          );
        }
        inscripcionUpdateData = {
          puntaje_final: notaDecimal,
          updated_at: new Date(),
        };
      } else {
        throw new BadRequestException(`ID de fase inválido: ${idFase}`);
      }

      // ... (Resto de la lógica de crear evaluaciones, log_cambios_nota y actualizar inscripciones) ...
      // 1. Crear la nueva evaluación
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

      // 2. Registrar el log
      await prisma.log_cambios_nota.create({
        data: {
          id_evaluacion: nuevaEval.id_evaluacion,
          id_usuario: idEvaluador,
          accion: 'REGISTRO',
          valor_anterior: null,
          valor_nuevo: notaDecimal,
        },
      });

      // 3. Actualizar la inscripción con el puntaje y clasificación
      await prisma.inscripciones.update({
        where: { id_inscripcion: idInscripcion },
        data: inscripcionUpdateData,
      });

      return nuevaEval;
    });

    return result;
  }

  // --- EDITAR NOTA MODIFICADA CON VALIDACIÓN ---
  async editarNota(dto: EditarNotaDto, idFase: number) {
    const { idEvaluacion, idUsuario, idEvaluador, nuevaNota, comentario } = dto;

    const evaluacion = await this.prisma.evaluaciones.findUnique({
      where: { id_evaluacion: idEvaluacion },
      include: {
        inscripcion: {
          select: { id_area: true, id_nivel: true, clasificacion: true },
        }, // 👈 incluir clasificacion
      },
    });
    if (!evaluacion) throw new NotFoundException('Evaluación no encontrada');

    const { id_area, id_nivel } = evaluacion.inscripcion;

    // 🛑 VALIDACIÓN CLAVE: Asegurar que la fase esté abierta para edición
    await this.fasesService.assertPhaseIsOpen(id_area, id_nivel, idFase);

    // Validación de consistencia: la evaluación debe pertenecer a la fase esperada
    if (evaluacion.id_fase !== idFase) {
      throw new ForbiddenException(
        `La evaluación #${idEvaluacion} no pertenece a la fase ${idFase}.`,
      );
    }

    const notaAnterior = evaluacion.nota;
    const idInscripcion = evaluacion.id_inscripcion;
    const nuevaNotaDecimal = new Prisma.Decimal(nuevaNota);

    const actualizada = await this.prisma.$transaction(async (prisma) => {
      let inscripcionUpdateData: Prisma.inscripcionesUpdateInput = {};

      if (idFase === 1) {
        // Fase Clasificatoria
        // Asegurarse de que no estamos editando clasificación cuando la fase ya pasó
        await this.assertCanEvaluateClasificacion(id_area, id_nivel);

        const nuevaClasificacion = await this.calcularClasificacion(
          nuevaNota,
          id_area,
          id_nivel,
        );
        inscripcionUpdateData = {
          puntaje_clasificacion: nuevaNotaDecimal,
          clasificacion: nuevaClasificacion,
          updated_at: new Date(),
        };
      } else if (idFase === 2) {
        // Fase Final
        // Opcional: Asegurar que el competidor esté clasificado (aunque en el caso de edición, ya debería estarlo)
        if (evaluacion.inscripcion.clasificacion !== 'CLASIFICADO') {
          throw new ForbiddenException(
            'Solo se pueden evaluar competidores clasificados en la Fase Final.',
          );
        }
        inscripcionUpdateData = {
          puntaje_final: nuevaNotaDecimal,
          updated_at: new Date(),
        };
      } else {
        throw new BadRequestException(`ID de fase inválido: ${idFase}`);
      }

      // ... (Resto de la lógica de actualizar evaluaciones, log_cambios_nota y actualizar inscripciones) ...
      // 1. Actualizar la evaluación
      const evalActualizada = await prisma.evaluaciones.update({
        where: { id_evaluacion: idEvaluacion },
        data: {
          id_evaluador: idEvaluador ?? evaluacion.id_evaluador,
          nota: nuevaNotaDecimal,
          fecha_registro: new Date(),
          comentario: comentario ?? evaluacion.comentario,
        },
      });

      // 2. Crear el log
      await prisma.log_cambios_nota.create({
        data: {
          id_evaluacion: idEvaluacion,
          id_usuario: idUsuario,
          accion: 'MODIFICACION',
          valor_anterior: notaAnterior as unknown as Prisma.Decimal,
          valor_nuevo: nuevaNotaDecimal,
        },
      });

      // 3. Actualizar la inscripción con el nuevo puntaje
      await prisma.inscripciones.update({
        where: { id_inscripcion: idInscripcion },
        data: inscripcionUpdateData,
      });

      return evalActualizada;
    });

    return actualizada;
  }
  private async assertCanEvaluateClasificacion(
    id_area: number,
    id_nivel: number,
  ) {
    // Verificamos si la FASE CLASIFICATORIA (ID 1) está VALIDADA.
    const cierreClasificatoria = await this.prisma.cierres_fase.findUnique({
      where: {
        uq_cierre_unico: { id_fase: 1, id_area: id_area, id_nivel: id_nivel },
      },
      select: { estado_validacion: true },
    });

    if (cierreClasificatoria?.estado_validacion === 'VALIDADO') {
      throw new ForbiddenException(
        'No se pueden registrar/editar notas de la Fase Clasificatoria (ID 1): la fase ha sido validada.',
      );
    }
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
