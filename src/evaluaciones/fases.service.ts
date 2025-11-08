import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type PhaseStatus = 'EN_PROCESO' | 'CERRADA' | 'VALIDADA';

@Injectable()
export class FasesService {
  constructor(private readonly prisma: PrismaService) {}

  // ... (getFaseId, esResponsableDelAreaYNivel, getStatus, hasPendingsToClose, closePhase, etc., sin cambios) ...

  /**
   * Asegura que la fase actual para el área/nivel dado esté EN_PROCESO.
   * Lanza ForbiddenException si está CERRADA o VALIDADA.
   */
  async assertPhaseIsOpen(id_area: number, id_nivel: number, id_fase: number) {
    // Reutilizamos la lógica de getStatus, pero con id_fase directo.
    const cierre = await this.prisma.cierres_fase.findUnique({
      where: {
        uq_cierre_unico: { id_fase, id_area, id_nivel },
      },
      select: { estado_validacion: true },
    });

    // Si no hay registro (EN_PROCESO) o está PENDIENTE, la fase está abierta para edición.
    if (!cierre || cierre.estado_validacion === 'PENDIENTE') {
      return; // La fase está abierta (EN_PROCESO o CERRADA PENDIENTE de validación)
    }

    // Si el estado es VALIDADO, no se permiten cambios.
    if (cierre.estado_validacion === 'VALIDADO') {
      throw new ForbiddenException(
        `La fase con ID ${id_fase} para el Área ${id_area} y Nivel ${id_nivel} ha sido validada y está bloqueada para cambios.`,
      );
    }
  }

  // ... (El resto de las funciones existentes: assertPhaseIsEditable, phaseLockedMessage, validateClose) ...
}
