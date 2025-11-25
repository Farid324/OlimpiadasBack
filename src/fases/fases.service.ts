// src/fases/fases.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PhaseType } from './dto/close-phase.dto';
import { estado_validacion } from '@prisma/client';
export type PhaseStatus = 'EN_PROCESO' | 'CERRADA' | 'VALIDADA';

@Injectable()
export class FasesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Devuelve el id_fase a partir del nombre de catálogo
   * CLASIFICACION -> CLASIFICATORIA
   * FINAL         -> FINAL
   */
  private async getFaseId(type: PhaseType): Promise<number> {
    const nombre_fase =
      type === PhaseType.CLASIFICACION ? 'CLASIFICATORIA' : 'FINAL';
    const fase = await this.prisma.fases.findFirst({
      where: { nombre_fase },
      select: { id_fase: true },
    });
    if (!fase) {
      throw new BadRequestException(
        'No se encontró la configuración de fases en el sistema.',
      );
    }
    return fase.id_fase;
  }

  private async esResponsableDelAreaYNivel(
    idUsuario: number,
    idArea: number,
    _idNivel: number,
  ): Promise<boolean> {
    const responsable = await this.prisma.responsables_area.findFirst({
      where: {
        id_usuario: idUsuario,
        id_area: idArea,
        activo: true,
      },
      select: { id_usuario: true },
    });

    return Boolean(responsable);
  }

  async getStatus(
    id_area: number,
    id_nivel: number,
    type: PhaseType,
  ): Promise<PhaseStatus> {
    const id_fase = await this.getFaseId(type);
    const cierre = await this.prisma.cierres_fase.findUnique({
      where: {
        uq_cierre_unico: { id_fase, id_area, id_nivel },
      },
      select: { estado_validacion: true },
    });
    if (!cierre) return 'EN_PROCESO';
    return cierre.estado_validacion === 'VALIDADO' ? 'VALIDADA' : 'CERRADA';
  }

  private async hasPendingsToClose(
    id_area: number,
    id_nivel: number,
    type: PhaseType,
  ): Promise<boolean> {
    if (type === PhaseType.CLASIFICACION) {
      const sinPuntaje = await this.prisma.inscripciones.count({
        where: { id_area, id_nivel, puntaje_clasificacion: null },
      });
      return sinPuntaje > 0;
    }

    //solo finalistas y solo evaluaciones de la fase FINAL
    const id_fase_final = await this.getFaseId(PhaseType.FINAL);

    const inscIds = await this.prisma.inscripciones.findMany({
      where: {
        id_area,
        id_nivel,
        clasificacion: 'CLASIFICADO',
        // opcional si quieres amarrarlo también al umbral
        // puntaje_clasificacion: 60
      },
      select: { id_inscripcion: true },
    });

    if (inscIds.length === 0) {
      // No hay nadie clasificado en este área/nivel entonces nada que evaluar en FINAL
      return false;
    }

    const ids = inscIds.map((i) => i.id_inscripcion);

    const abiertas = await this.prisma.evaluaciones
      .count({
        where: {
          id_inscripcion: { in: ids },
          id_fase: id_fase_final,
          estado_registro: { not: 'BORRADOR' },
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
    const { id_area, id_nivel, type, actor_id } = params;

    const autorizado = await this.esResponsableDelAreaYNivel(
      actor_id,
      id_area,
      id_nivel,
    );
    if (!autorizado) {
      const areaNombre = await this.prisma.areas.findUnique({
        where: { id_area },
        select: { nombre_area: true },
      });

      throw new ForbiddenException(
        `Solo el responsable del área ${areaNombre?.nombre_area ?? id_area} puede cerrar o validar esta fase.`,
      );
    }

    const status = await this.getStatus(id_area, id_nivel, type);
    if (status === 'CERRADA' || status === 'VALIDADA') {
      throw new BadRequestException(
        'Esta fase ya fue cerrada anteriormente para este área y nivel.',
      );
    }

    const pendientes = await this.hasPendingsToClose(id_area, id_nivel, type);
    if (pendientes) {
      throw new BadRequestException(
        'No es posible cerrar la fase: aún existen evaluaciones pendientes.',
      );
    }

    const id_fase = await this.getFaseId(type);

    await this.prisma.cierres_fase.upsert({
      where: { uq_cierre_unico: { id_fase, id_area, id_nivel } },
      update: {
        estado_validacion: 'PENDIENTE',
        cerrado_por: actor_id,
        fecha_cierre: new Date(),
      },
      create: {
        id_fase,
        id_area,
        id_nivel,
        cerrado_por: actor_id,
        fecha_cierre: new Date(),
        estado_validacion: 'PENDIENTE',
      },
    });
    const inscripciones = await this.prisma.inscripciones.findMany({
      where: { id_area, id_nivel },
      select: { id_inscripcion: true },
    });

    if (inscripciones.length > 0) {
      const ids = inscripciones.map((i) => i.id_inscripcion);
      await this.prisma.evaluaciones.updateMany({
        where: {
          id_inscripcion: { in: ids },
          id_fase,
        },
        data: { estado_registro: 'FIRMADA' },
      });
    }

    if (type === PhaseType.CLASIFICACION) {
      // EVALUANDO → CLASIFICANDO
      await this.prisma.areas.updateMany({
        where: {
          id_area,
          estado: 'EVALUANDO',
        },
        data: { estado: 'CLASIFICANDO' },
      });
    } else if (type === PhaseType.FINAL) {
      // CLASIFICANDO → COMPLETADO
      await this.prisma.areas.updateMany({
        where: {
          id_area,
          estado: 'CLASIFICANDO',
        },
        data: { estado: 'COMPLETADO' },
      });
    }

    return {
      ok: true,
      message:
        'Fase cerrada correctamente. Los reportes oficiales han sido habilitados.',
      status: 'CERRADA' as PhaseStatus,
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

  async isPhaseEnabledGlobally(type: PhaseType): Promise<boolean> {
    const id_fase = await this.getFaseId(type);

    // Solo consideramos cierres VALIDADOS.
    const count = await this.prisma.cierres_fase.count({
      where: {
        id_fase,
        estado_validacion: {
          in: [estado_validacion.PENDIENTE, estado_validacion.VALIDADO],
        },
      },
    });

    return count > 0;
  }

  phaseLockedMessage(type: PhaseType): string {
    return type === PhaseType.FINAL
      ? 'Fase Bloqueada. La fase final aún no ha sido aprobada. Los reportes se habilitarán una vez que des el aval correspondiente.'
      : 'Fase Bloqueada. La fase de clasificación aún no ha sido aprobada. Los reportes se habilitarán una vez que des el aval correspondiente.';
  }

  async validateClose(params: {
    id_area: number;
    id_nivel: number;
    type: PhaseType;
    actor_id: number;
    comment?: string;
  }) {
    const { id_area, id_nivel, type, actor_id } = params;
    const id_fase = await this.getFaseId(type);

    const cierre = await this.prisma.cierres_fase.findUnique({
      where: { uq_cierre_unico: { id_fase, id_area, id_nivel } },
      select: { id_cierre: true },
    });

    const autorizado = await this.esResponsableDelAreaYNivel(
      actor_id,
      id_area,
      id_nivel,
    );
    if (!autorizado) {
      const areaNombre = await this.prisma.areas.findUnique({
        where: { id_area },
        select: { nombre_area: true },
      });

      throw new ForbiddenException(
        `Solo el responsable del área ${areaNombre?.nombre_area ?? id_area} puede cerrar o validar esta fase.`,
      );
    }

    if (!cierre) {
      throw new BadRequestException(
        'Primero debes cerrar la fase antes de validarla.',
      );
    }

    await this.prisma.cierres_fase.update({
      where: { id_cierre: cierre.id_cierre },
      data: {
        estado_validacion: 'VALIDADO',
        validado_por: actor_id,
        fecha_validacion: new Date(),
      },
    });

    return {
      ok: true,
      message:
        'Fase validada correctamente. Se habilitan certificados y publicaciones.',
      status: 'VALIDADA' as PhaseStatus,
    };
  }
}
