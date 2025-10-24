// src/fases/fases.service.ts

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type PhaseType = 'CLASIFICACION' | 'FINAL';
export type PhaseStatus = 'EN_PROCESO' | 'CERRADA' | 'VALIDADA';

@Injectable()
export class FasesService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensurePhaseState(
    id_area: number,
    id_nivel: number,
    type: PhaseType,
  ) {
    let state = await this.prisma.phases_state.findUnique({
      where: {
        ux_phase_uniqueness: {
          id_area: BigInt(id_area),
          id_nivel: BigInt(id_nivel),
          type,
        },
      },
    });
    if (!state) {
      state = await this.prisma.phases_state.create({
        data: {
          id_area: BigInt(id_area),
          id_nivel: BigInt(id_nivel),
          type,
          status: 'EN_PROCESO',
        },
      });
    }
    return state;
  }

  // se consulta estado actual
  async getStatus(
    id_area: number,
    id_nivel: number,
    type: PhaseType,
  ): Promise<PhaseStatus> {
    const s = await this.ensurePhaseState(id_area, id_nivel, type);
    return s.status as PhaseStatus;
  }

  // se establece regla: pendientes para poder cerrar?
  private async hasPendingsToClose(
    id_area: number,
    id_nivel: number,
    type: PhaseType,
  ) {
    if (type === 'CLASIFICACION') {
      const sinPuntaje = await this.prisma.inscripciones.count({
        where: { id_area, id_nivel, puntaje_clasificacion: null },
      });
      return sinPuntaje > 0;
    }
    const inscIds = await this.prisma.inscripciones.findMany({
      where: { id_area, id_nivel },
      select: { id_inscripcion: true },
    });
    if (inscIds.length === 0) {
      return true;
    }

    const ids = inscIds.map((i) => i.id_inscripcion);

    const abiertas = await this.prisma.evaluaciones
      .count({
        where: {
          id_inscripcion: { in: ids },
          estado_registro: { not: 'FIRMADA' as any },
        },
      })
      .catch(() => 0);

    return abiertas > 0;
  }

  async closePhase(params: {
    id_area: number;
    id_nivel: number;
    type: PhaseType;
    actor_id: number;
    comment?: string;
  }) {
    const { id_area, id_nivel, type, actor_id, comment } = params;

    const current = await this.ensurePhaseState(id_area, id_nivel, type);

    if (current.status === 'CERRADA' || current.status === 'VALIDADA') {
      throw new BadRequestException('Esta fase ya fue cerrada anteriormente.');
    }

    const hasPendings = await this.hasPendingsToClose(id_area, id_nivel, type);
    if (hasPendings) {
      throw new BadRequestException(
        'No es posible cerrar la fase: aún existen evaluaciones pendientes.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const s = await tx.phases_state.update({
        where: { id_state: current.id_state },
        data: {
          status: 'CERRADA',
          locked_at: new Date(),
          closed_by: BigInt(actor_id),
        },
      });

      await tx.phases_events.create({
        data: {
          id_state: s.id_state,
          event: 'CLOSE',
          actor_id: BigInt(actor_id),
          message: comment ?? null,
          metadata: { id_area, id_nivel, type },
        },
      });

      return s;
    });

    return {
      ok: true,
      message:
        'Fase cerrada correctamente. Los reportes oficiales han sido habilitados.',
      status: updated.status,
      locked_at: updated.locked_at,
    };
  }

  async assertPhaseIsEditable(
    id_area: number,
    id_nivel: number,
    type: PhaseType,
  ) {
    const status = await this.getStatus(id_area, id_nivel, type);
    if (status !== 'EN_PROCESO') {
      throw new ForbiddenException(
        'La fase está cerrada: no se permiten más cambios.',
      );
    }
  }
}
