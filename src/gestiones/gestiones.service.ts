// src/gestiones/gestiones.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  estado_gestion,
  estado_validacion,
  tipo_area_config,
  gestiones,
  areas_gestion,
} from '@prisma/client';

// ===================== TIPOS =====================

type AreaGestionHistorial = {
  id_area_gestion: number;
  id_gestion: number;
  nombre_area: string;
  nota_aprobacion: number | null;
  tipo: tipo_area_config;
  niveles_target: string | null;
  archived_at: Date;
};

type GestionConAreas = {
  id_gestion: number;
  anio: number;
  nombre: string | null;
  estado: estado_gestion;
  closed_at: Date | null;
  areas: AreaGestionHistorial[];
};

type GestionCerradaMetadata = {
  id_gestion: number;
  anio: number;
  nombre: string | null;
  closed_at: Date | null;
  total_areas: number;
};

type CloseGestionResult = {
  gestion: gestiones;
  areasArchivadas: number;
};

// Tipo para gestión con áreas incluidas
type GestionWithAreas = gestiones & {
  areas_gestion: areas_gestion[];
};

@Injectable()
export class GestionesService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentOpenGestion(): Promise<gestiones | null> {
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: estado_gestion.ABIERTA },
      orderBy: { created_at: 'desc' },
    });

    return gestion ?? null;
  }

  async listAll(): Promise<gestiones[]> {
    return this.prisma.gestiones.findMany({
      orderBy: [{ anio: 'desc' }, { created_at: 'desc' }],
    });
  }

  /**
   * Regla para poder cerrar gestión:
   * - Debe existir al menos un cierre validado para CLASIFICATORIA y FINAL
   * - No debe existir ningún cierre en estado distinto de validado
   */
  async getCloseEligibility(): Promise<{
    canClose: boolean;
    reason: string | null;
    gestionId: number | null;
  }> {
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
            id_gestion: current.id_gestion,
            estado_validacion: { not: estado_validacion.VALIDADO },
          },
        }),
        this.prisma.cierres_fase.count({
          where: {
            id_fase: faseFinal.id_fase,
            id_gestion: current.id_gestion,
            estado_validacion: { not: estado_validacion.VALIDADO },
          },
        }),
        this.prisma.cierres_fase.count({
          where: {
            id_fase: faseClasif.id_fase,
            id_gestion: current.id_gestion,
            estado_validacion: estado_validacion.VALIDADO,
          },
        }),
        this.prisma.cierres_fase.count({
          where: {
            id_fase: faseFinal.id_fase,
            id_gestion: current.id_gestion,
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

  /**
   * Cierra la gestión actual y archiva las áreas activas
   */
  async closeCurrentGestion(): Promise<CloseGestionResult> {
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

    // Ejecutar todo en una transacción
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Obtener todas las áreas activas
      const areasActivas = await tx.areas.findMany({
        where: { activo: true },
        select: {
          nombre_area: true,
          nota_aprobacion: true,
          tipo: true,
          niveles_target: true,
        },
      });

      // 2. Archivar las áreas en areas_gestion
      if (areasActivas.length > 0) {
        const areasToArchive = areasActivas.map((area) => ({
          id_gestion: current.id_gestion,
          nombre_area: area.nombre_area,
          nota_aprobacion: area.nota_aprobacion,
          tipo: area.tipo ?? tipo_area_config.INDIVIDUAL,
          niveles_target: area.niveles_target,
        }));

        await tx.areas_gestion.createMany({
          data: areasToArchive,
        });
      }

      // 3. Desactivar todas las áreas activas (soft delete)
      await tx.areas.updateMany({
        where: { activo: true },
        data: {
          activo: false,
          estado: 'EVALUANDO', // Resetear estado para la próxima gestión
        },
      });

      // 4. Cerrar la gestión
      const updatedGestion = await tx.gestiones.update({
        where: { id_gestion: current.id_gestion },
        data: {
          estado: estado_gestion.CERRADA,
          closed_at: new Date(),
        },
      });

      return {
        gestion: updatedGestion,
        areasArchivadas: areasActivas.length,
      };
    });

    return result;
  }

  async openNewGestion(anio: number, nombre?: string): Promise<gestiones> {
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

  /**
   * Obtener historial de áreas por gestiones cerradas
   */
  async getAreasHistorial(): Promise<GestionConAreas[]> {
    const gestionesCerradas: GestionWithAreas[] =
      await this.prisma.gestiones.findMany({
        where: { estado: estado_gestion.CERRADA },
        orderBy: [{ anio: 'desc' }, { closed_at: 'desc' }],
        include: {
          areas_gestion: {
            orderBy: { nombre_area: 'asc' },
          },
        },
      });

    const result: GestionConAreas[] = gestionesCerradas.map(
      (gestion: GestionWithAreas) => ({
        id_gestion: gestion.id_gestion,
        anio: gestion.anio,
        nombre: gestion.nombre,
        estado: gestion.estado,
        closed_at: gestion.closed_at,
        areas: gestion.areas_gestion.map((area: areas_gestion) => ({
          id_area_gestion: area.id_area_gestion,
          id_gestion: area.id_gestion,
          nombre_area: area.nombre_area,
          nota_aprobacion: area.nota_aprobacion,
          tipo: area.tipo,
          niveles_target: area.niveles_target,
          archived_at: area.archived_at,
        })),
      }),
    );

    return result;
  }

  /**
   * Obtener áreas de una gestión específica
   */
  async getAreasByGestion(idGestion: number): Promise<AreaGestionHistorial[]> {
    const areas: areas_gestion[] = await this.prisma.areas_gestion.findMany({
      where: { id_gestion: idGestion },
      orderBy: { nombre_area: 'asc' },
    });

    return areas.map((area: areas_gestion) => ({
      id_area_gestion: area.id_area_gestion,
      id_gestion: area.id_gestion,
      nombre_area: area.nombre_area,
      nota_aprobacion: area.nota_aprobacion,
      tipo: area.tipo,
      niveles_target: area.niveles_target,
      archived_at: area.archived_at,
    }));
  }

  /**
   * Obtener lista de gestiones cerradas (solo metadatos)
   */
  async getGestionesCerradas(): Promise<GestionCerradaMetadata[]> {
    const gestiones = await this.prisma.gestiones.findMany({
      where: { estado: estado_gestion.CERRADA },
      orderBy: [{ anio: 'desc' }, { closed_at: 'desc' }],
      select: {
        id_gestion: true,
        anio: true,
        nombre: true,
        closed_at: true,
        _count: {
          select: { areas_gestion: true },
        },
      },
    });

    return gestiones.map((g) => ({
      id_gestion: g.id_gestion,
      anio: g.anio,
      nombre: g.nombre,
      closed_at: g.closed_at,
      total_areas: g._count.areas_gestion,
    }));
  }
}
