// src/areas/services/areas.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAreaDto } from '../dto/create-area.dto';
// ⚠️ Importar los nuevos DTOs
import {
  DashboardResponse,
  DashboardMetrics,
} from '../dto/dashboard-response.dto';

// Define el tipo de estado para que sea reconocido en este archivo
type estado_area = 'EVALUANDO' | 'CLASIFICANDO' | 'COMPLETADO';

@Injectable()
export class AreasService {
  constructor(private prisma: PrismaService) {}

  // jaumpi y vivi
  findAll() {
    return this.prisma.areas.findMany({
      where: { activo: true },
      orderBy: { nombre_area: 'asc' },
    });
  }

  // far
  async create(data: CreateAreaDto) {
    return this.prisma.areas.create({
      data: {
        nombre_area: data.nombre_area,
        nota_aprobacion: data.nota_aprobacion,
        tipo: data.tipo,
        niveles_target: data.niveles_target,
        activo: true,
      },
    });
  }

  async update(id: number, data: CreateAreaDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Actualizar el área
      const areaActualizada = await tx.areas.update({
        where: { id_area: id },
        data: {
          nombre_area: data.nombre_area,
          nota_aprobacion: data.nota_aprobacion,
          tipo: data.tipo,
          niveles_target: data.niveles_target,
        },
      });

      const notaAprobacion = areaActualizada.nota_aprobacion;

      // 2. Actualizar clasificaciones
      await tx.inscripciones.updateMany({
        where: {
          id_area: id,
          puntaje_clasificacion: { not: null },
        },
        data: {
          clasificacion: null,
        },
      });

      if (notaAprobacion !== null) {
        // 3. Clasificados
        await tx.inscripciones.updateMany({
          where: {
            id_area: id,
            puntaje_clasificacion: {
              gte: notaAprobacion,
            },
          },
          data: {
            clasificacion: 'CLASIFICADO',
          },
        });

        // 4. No clasificados
        await tx.inscripciones.updateMany({
          where: {
            id_area: id,
            puntaje_clasificacion: {
              lt: notaAprobacion,
            },
          },
          data: {
            clasificacion: 'NO_CLASIFICADO',
          },
        });
      }

      return areaActualizada;
    });
  }

  async remove(id: number) {
    // Soft delete (solo desactivar)
    return this.prisma.areas.update({
      where: { id_area: id },
      data: { activo: false },
    });
  }

  /* ============================================================
   * 1) Estadísticas GENERALES (formato agrupado por área)
   * -> Usar en las demás pestañas
   * ============================================================ */
  async getAreasConEstadisticas() {
    console.log('💡 Iniciando consulta a Prisma (general)...');

    const areas = await this.prisma.areas.findMany({
      where: { activo: true },
      include: {
        inscripciones: {
          include: { nivel: true },
        },
      },
    });

    console.log('💡 Consulta realizada, areas:', areas.length);

    const mapped = areas.map((area) => {
      const nivelesMap: Record<
        string,
        { id_nivel: number; nombre_nivel: string; inscritos: number }
      > = {};

      area.inscripciones.forEach((insc) => {
        if (!insc.nivel) return;
        const nivelIdStr = insc.nivel.id_nivel.toString();
        if (!nivelesMap[nivelIdStr]) {
          nivelesMap[nivelIdStr] = {
            id_nivel: Number(insc.nivel.id_nivel), // BigInt -> number
            nombre_nivel: insc.nivel.nombre_nivel,
            inscritos: 0,
          };
        }
        nivelesMap[nivelIdStr].inscritos += 1;
      });

      return {
        id_area: Number(area.id_area),
        nombre_area: area.nombre_area,
        estado: area.estado,
        // ✅ AGREGA ESTOS CAMPOS QUE FALTABAN:
        nota_aprobacion: area.nota_aprobacion,
        tipo: area.tipo,
        niveles_target: area.niveles_target,
        activo: area.activo,

        niveles: Object.values(nivelesMap),
      };
    });

    console.log('💡 Datos devueltos por el servicio (general):', mapped.length);
    return mapped;
  }

  /* =================================================================
   * 2) Estadísticas para PANEL PRINCIPAL (CORREGIDO)
   * - Devuelve combinaciones Área + Nivel (mantenida intacta)
   * ================================================================= */
  async getAreasConEstadisticasPanelPrincipal() {
    console.log('💡 Iniciando consulta a Prisma (panel principal)...');

    const NIVELES_PERMITIDOS = ['PRIMARIA', 'SECUNDARIA'];

    // 1. Consulta inicial para obtener áreas e inscripciones (IDs y nombres)
    const areas = await this.prisma.areas.findMany({
      where: { activo: true },
      select: {
        id_area: true,
        nombre_area: true,
        inscripciones: {
          select: {
            nivel: {
              select: {
                id_nivel: true,
                nombre_nivel: true,
              },
            },
          },
        },
      },
      orderBy: { nombre_area: 'asc' },
    });

    // --- Preparación para obtener el estado específico por A/N ---

    const areaNivelKeys = new Set<string>(); // Para almacenar "id_area-id_nivel"
    const nivelDetailsMap = new Map<number, { id: number; nombre: string }>();

    areas.forEach((area) => {
      area.inscripciones.forEach((inscripcion) => {
        if (!inscripcion.nivel) return;

        const idNivel = Number(inscripcion.nivel.id_nivel);
        const nombreNivel = inscripcion.nivel.nombre_nivel?.toUpperCase() ?? '';

        const esNivelPermitido = NIVELES_PERMITIDOS.some((niv) =>
          nombreNivel.includes(niv),
        );
        if (!esNivelPermitido) return;

        areaNivelKeys.add(`${area.id_area}-${idNivel}`);
        if (!nivelDetailsMap.has(idNivel)) {
          nivelDetailsMap.set(idNivel, {
            id: idNivel,
            nombre: inscripcion.nivel.nombre_nivel,
          });
        }
      });
    });

    // Obtenemos listas de IDs únicos para la consulta batch
    const areaIds = Array.from(
      new Set(Array.from(areaNivelKeys).map((k) => Number(k.split('-')[0]))),
    );
    const nivelIds = Array.from(
      new Set(Array.from(areaNivelKeys).map((k) => Number(k.split('-')[1]))),
    );

    // 2. Consultar todas las FASES para entender el orden de avance
    const fases = await this.prisma.fases.findMany({
      orderBy: { orden_fase: 'asc' },
      select: { id_fase: true, orden_fase: true },
    });

    // 3. Consultar TODOS los cierres relevantes en UNA sola query (EFICIENTE)
    // ✅ INCLUYE ESTADOS 'VALIDADO' y 'PENDIENTE' para reflejar el avance inmediato
    const cierresValidados = await this.prisma.cierres_fase.findMany({
      where: {
        id_area: { in: areaIds },
        id_nivel: { in: nivelIds },
        estado_validacion: { in: ['VALIDADO', 'PENDIENTE'] },
      },
      select: {
        id_area: true,
        id_nivel: true,
        id_fase: true,
      },
    });

    // 4. Mapear cierres a un estado por combinación (Area-Nivel)
    const estadoPorAreaNivel = new Map<string, estado_area>();

    for (const key of areaNivelKeys) {
      const [id_area, id_nivel] = key.split('-').map(Number);
      const cierresAreaNivel = cierresValidados.filter(
        (c) => c.id_area === id_area && c.id_nivel === id_nivel,
      );

      let estado: estado_area = 'EVALUANDO'; // Estado por defecto

      if (cierresAreaNivel.length > 0) {
        // Encontrar el ORDEN de la fase más avanzada (mayor orden_fase) que ha sido CERRADA
        const maxOrdenFaseCerrada = cierresAreaNivel.reduce(
          (maxOrden, currentCierre) => {
            const currentFase = fases.find(
              (f) => f.id_fase === currentCierre.id_fase,
            );
            return Math.max(maxOrden, currentFase?.orden_fase ?? 0);
          },
          0,
        );

        // ⚠️ LÓGICA DE NEGOCIO: ASIGNAR ESTADO BASADO EN LA FASE CERRADA
        if (maxOrdenFaseCerrada >= 2) {
          // Si la Fase 2 (o superior) está cerrada/validada/pendiente
          estado = 'COMPLETADO';
        } else if (maxOrdenFaseCerrada >= 1) {
          // Si la Fase 1 está cerrada/validada/pendiente
          estado = 'CLASIFICANDO';
        }
      }

      estadoPorAreaNivel.set(key, estado);
    }

    // --- Generación de la Respuesta Final ---

    const combinaciones: {
      id_area: number;
      nombre_area: string;
      estado: estado_area;
      id_nivel: number;
      nombre_nivel: string;
      total_inscritos: number;
    }[] = [];

    // Re-procesar áreas para calcular el total de inscritos y asignar el estado calculado
    areas.forEach((area) => {
      const nivelesMap = new Map<number, number>(); // Map<id_nivel, count>

      area.inscripciones.forEach((inscripcion) => {
        if (!inscripcion.nivel) return;

        const idNivel = Number(inscripcion.nivel.id_nivel);
        const nombreNivel = inscripcion.nivel.nombre_nivel?.toUpperCase() ?? '';

        const esNivelPermitido = NIVELES_PERMITIDOS.some((niv) =>
          nombreNivel.includes(niv),
        );
        if (!esNivelPermitido) return;

        // Contar inscritos por nivel
        nivelesMap.set(idNivel, (nivelesMap.get(idNivel) || 0) + 1);
      });

      // Generar la entrada de combinación con el estado específico
      nivelesMap.forEach((count, id_nivel) => {
        const details = nivelDetailsMap.get(id_nivel);
        if (!details) return;

        const key = `${area.id_area}-${id_nivel}`;
        const estadoEspecifico = estadoPorAreaNivel.get(key) || 'EVALUANDO';

        combinaciones.push({
          id_area: Number(area.id_area),
          nombre_area: area.nombre_area,
          estado: estadoEspecifico,
          id_nivel: details.id,
          nombre_nivel: details.nombre,
          total_inscritos: count,
        });
      });
    });

    // Ordenar por área y luego por nivel
    combinaciones.sort((a, b) => {
      if (a.nombre_area < b.nombre_area) return -1;
      if (a.nombre_area > b.nombre_area) return 1;
      return a.nombre_nivel.localeCompare(b.nombre_nivel);
    });

    console.log(
      '💡 Datos devueltos por el servicio (panel principal, combinaciones A/N):',
      combinaciones.length,
    );
    return combinaciones;
  }

  /* =================================================================
   * 3) FUNCIÓN PRINCIPAL DEL DASHBOARD: Métricas Globales + Stats A/N
   * ================================================================= */

  async getDashboardData(): Promise<DashboardResponse> {
    // --- 1. Obtener los detalles de Área/Nivel (Tu lógica existente) ---
    const areasStats = await this.getAreasConEstadisticasPanelPrincipal();

    // --- 2. Obtener todos los contadores globales en paralelo (6 queries) ---
    const [
      totalRegistrosCount,
      totalEvaluadoresCount,
      totalResponsablesCount, // ✅ NUEVO CONTADOR
      areasActivasCount,
      totalClasificadosCount,
      totalPremiadosCount,
    ] = await Promise.all([
      // 1. Total Olimpistas (Inscripciones)
      this.prisma.inscripciones.count({}),

      // 2. Total Evaluadores (Asignados activos)
      this.prisma.evaluadores_area.count({
        where: { activo: true },
      }),

      // 3. Total Responsables (Asignados activos)
      this.prisma.responsables_area.count({
        where: { activo: true },
      }),

      // 4. Áreas Activas (Disciplinas únicas)
      this.prisma.areas.count({ where: { activo: true } }),

      // 5. Total Clasificados
      this.prisma.inscripciones.count({
        where: { clasificacion: 'CLASIFICADO' },
      }),

      // 6. Total Premiados
      this.prisma.premios_otorgados.count({}),
    ]);

    // 7. Áreas en Evaluación (basado en las combinaciones A/N)
    const areasEnEvaluacion = areasStats.filter(
      (a) => a.estado === 'EVALUANDO' || a.estado === 'CLASIFICANDO',
    ).length;

    // --- 3. Construir el objeto de métricas final ---
    const metrics: DashboardMetrics = {
      totalOlimpiadas: 1,
      totalRegistros: totalRegistrosCount,
      totalAreas: areasActivasCount,
      areasActivas: areasActivasCount,
      totalEvaluadores: totalEvaluadoresCount,
      totalResponsables: totalResponsablesCount, // ✅ NUEVA MÉTRICA ASIGNADA
      totalClasificados: totalClasificadosCount,
      totalPremiados: totalPremiadosCount,
      areasEnEvaluacion: areasEnEvaluacion,
    };

    return {
      metrics,
      areasStats,
    };
  }

  // Fabia y max
  findAllActive() {
    return this.prisma.areas.findMany({
      where: { activo: true },
      select: { id_area: true, nombre_area: true },
      orderBy: { nombre_area: 'asc' },
    });
  }
}
