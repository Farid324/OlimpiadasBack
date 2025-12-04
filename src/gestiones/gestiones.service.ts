// src/gestiones/gestiones.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { estado_gestion, estado_validacion } from '@prisma/client';

@Injectable()
export class GestionesService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentOpenGestion() {
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: estado_gestion.ABIERTA },
      orderBy: { created_at: 'desc' },
    });

    return gestion ?? null;
  }

  async listAll() {
    return this.prisma.gestiones.findMany({
      orderBy: [{ anio: 'desc' }, { created_at: 'desc' }],
    });
  }

  /*
   * Regla para poder cerrar gestion, no se filtra por gestión porque solo puede haber una abierta a la vez.
   * - Debe existir al menos un cierre validado para CLASIFICATORIA y FINAL
   * - No debe existir ningun cierre en estado distinto de valida.
   */
  async getCloseEligibility() {
    const current = await this.getCurrentOpenGestion();
    if (!current) {
      return {
        canClose: false,
        reason: 'No hay una gestión abierta actualmente.',
        gestionId: null,
      };
    }

    const faseClasif = await this.prisma.fases.findFirst({
      where: { nombre_fase: 'CLASIFICATORIA' },
      select: { id_fase: true },
    });
    const faseFinal = await this.prisma.fases.findFirst({
      where: { nombre_fase: 'FINAL' },
      select: { id_fase: true },
    });

    if (!faseClasif || !faseFinal) {
      return {
        canClose: false,
        reason:
          'No están configuradas correctamente las fases CLASIFICATORIA y FINAL.',
        gestionId: current.id_gestion,
      };
    }

    const [pendientesClasif, pendientesFinal, validClasif, validFinal] =
      await Promise.all([
        this.prisma.cierres_fase.count({
          where: {
            id_fase: faseClasif.id_fase,
            estado_validacion: { not: estado_validacion.VALIDADO },
          },
        }),
        this.prisma.cierres_fase.count({
          where: {
            id_fase: faseFinal.id_fase,
            estado_validacion: { not: estado_validacion.VALIDADO },
          },
        }),
        this.prisma.cierres_fase.count({
          where: {
            id_fase: faseClasif.id_fase,
            estado_validacion: estado_validacion.VALIDADO,
          },
        }),
        this.prisma.cierres_fase.count({
          where: {
            id_fase: faseFinal.id_fase,
            estado_validacion: estado_validacion.VALIDADO,
          },
        }),
      ]);

    if (validClasif === 0 || validFinal === 0) {
      return {
        canClose: false,
        reason:
          'No es posible cerrar la gestión: aún no hay cierres validados para ambas fases (clasificación y final).',
        gestionId: current.id_gestion,
      };
    }

    if (pendientesClasif > 0 || pendientesFinal > 0) {
      return {
        canClose: false,
        reason:
          'No es posible cerrar la gestión: existen cierres de fase pendientes o sin validar.',
        gestionId: current.id_gestion,
      };
    }

    return {
      canClose: true,
      reason: null,
      gestionId: current.id_gestion,
    };
  }

  async closeCurrentGestion() {
    const current = await this.getCurrentOpenGestion();
    if (!current) {
      throw new BadRequestException('No hay una gestión abierta para cerrar.');
    }

    const eligibility = await this.getCloseEligibility();
    if (!eligibility.canClose) {
      throw new BadRequestException(
        eligibility.reason ??
          'No se cumplen las condiciones para cerrar la gestión.',
      );
    }

    const updated = await this.prisma.gestiones.update({
      where: { id_gestion: current.id_gestion },
      data: { estado: estado_gestion.CERRADA },
    });

    return updated;
  }

  async openNewGestion(anio: number, nombre?: string) {
    const existingOpen = await this.getCurrentOpenGestion();
    if (existingOpen) {
      throw new BadRequestException(
        'Ya existe una gestión abierta. Debes cerrarla antes de iniciar una nueva.',
      );
    }

    const gestion = await this.prisma.gestiones.create({
      data: {
        anio,
        nombre: nombre?.trim() || null,
        estado: estado_gestion.ABIERTA,
      },
    });

    return gestion;
  }
}
