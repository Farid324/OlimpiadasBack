// src/areas/services/areas.service.ts
import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAreaDto } from '../dto/create-area.dto';
import {
  DashboardResponse,
  DashboardMetrics,
  AreaNivelStats, // Asegúrate de que este tipo esté exportado en tu DTO
} from '../dto/dashboard-response.dto';

// Define el tipo de estado para que sea reconocido en este archivo
type estado_area = 'EVALUANDO' | 'CLASIFICANDO' | 'COMPLETADO';

@Injectable()
export class AreasService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.areas.findMany({
      where: { activo: true },
      orderBy: { nombre_area: 'asc' },
    });
  }

  async create(data: CreateAreaDto) {
    // 1. Buscar si el nombre ya existe (activo o inactivo)
    const existing = await this.prisma.areas.findUnique({
      where: { nombre_area: data.nombre_area },
    });

    if (existing) {
      if (existing.activo) {
        // Si existe y está activo -> Error real de duplicado
        throw new ConflictException('El nombre del área ya existe.');
      } else {
        // Si existe pero estaba "eliminado" (activo: false) -> Lo reactivamos y actualizamos
        return this.prisma.areas.update({
          where: { id_area: existing.id_area },
          data: {
            nota_aprobacion: data.nota_aprobacion,
            nota_aprobacion_final: data.nota_aprobacion_final,
            tipo: data.tipo,
            niveles_target: data.niveles_target,
            activo: true, // ✨ Reactivamos el área
          },
        });
      }
    }

    // Si no existe, creamos uno nuevo
    return this.prisma.areas.create({
      data: {
        nombre_area: data.nombre_area,
        nota_aprobacion: data.nota_aprobacion,
        nota_aprobacion_final: data.nota_aprobacion_final,
        tipo: data.tipo,
        niveles_target: data.niveles_target,
        activo: true,
      },
    });
  }

  async update(id: number, data: CreateAreaDto) {
    // Validar que si cambian el nombre, no choque con otro existente
    const existingName = await this.prisma.areas.findFirst({
      where: {
        nombre_area: data.nombre_area,
        id_area: { not: id }, // Excluir el actual
      },
    });

    if (existingName) {
      throw new ConflictException(
        'El nombre del área ya está en uso por otro registro.',
      );
    }

    const areaActual = await this.prisma.areas.findUnique({
      where: { id_area: id },
    });

    if (!areaActual) {
      throw new NotFoundException('Área no encontrada.');
    }

    // No se puede quitar niveles, solo agregar
    const nivelesOriginal = (areaActual.niveles_target ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const nivelesNuevos = (data.niveles_target ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const nivelesQuitados = nivelesOriginal.filter(
      (n) => !nivelesNuevos.includes(n),
    );

    if (nivelesQuitados.length > 0) {
      throw new ConflictException(
        `No puedes quitar niveles registrados previamente: ${nivelesQuitados.join(', ')}`,
      );
    }

    // No se puede quitar tipo
    if (areaActual.tipo === 'GRUPAL' && data.tipo === 'INDIVIDUAL') {
      throw new ConflictException(
        'No se puede cambiar el tipo de GRUPAL a INDIVIDUAL porque ya existe información registrada.',
      );
    }

    // 3️⃣ Si la fase 1 está cerrada → no se puede modificar nota_aprobacion
    const fase1Cerrada = await this.prisma.cierres_fase.findFirst({
      where: {
        id_area: id,
        id_fase: 1, // fase de clasificación
      },
    });

    if (fase1Cerrada) {
      if (data.nota_aprobacion !== areaActual.nota_aprobacion) {
        throw new ConflictException(
          'La fase de clasificación (fase 1) ya está cerrada. No se puede modificar la nota de aprobación.',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const areaActualizada = await tx.areas.update({
        where: { id_area: id },
        data: {
          nombre_area: data.nombre_area,
          nota_aprobacion: data.nota_aprobacion,
          nota_aprobacion_final: data.nota_aprobacion_final,
          tipo: data.tipo,
          niveles_target: data.niveles_target,
        },
      });

      const notaAprobacion = areaActualizada.nota_aprobacion;

      // Actualizar clasificaciones (Lógica existente)
      await tx.inscripciones.updateMany({
        where: {
          id_area: id,
          puntaje_clasificacion: { not: null },
        },
        data: { clasificacion: null },
      });

      if (notaAprobacion !== null) {
        await tx.inscripciones.updateMany({
          where: {
            id_area: id,
            puntaje_clasificacion: { gte: notaAprobacion },
          },
          data: { clasificacion: 'CLASIFICADO' },
        });

        await tx.inscripciones.updateMany({
          where: {
            id_area: id,
            puntaje_clasificacion: { lt: notaAprobacion },
          },
          data: { clasificacion: 'NO_CLASIFICADO' },
        });
      }

      return areaActualizada;
    });
  }

  async remove(id: number) {
    // Validación previa: Verificar si tiene inscripciones
    const inscripciones = await this.prisma.inscripciones.count({
      where: { id_area: id },
    });

    if (inscripciones > 0) {
      throw new ConflictException(
        'No se puede eliminar el área porque tiene olimpistas inscritos.',
      );
    }

    return this.prisma.areas.update({
      where: { id_area: id },
      data: { activo: false },
    });
  }

  /* ============================================================
   * 1) Estadísticas GENERALES (formato agrupado por área)
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
      //1️⃣ CORRECCIÓN: Tipado explícito en lugar de 'any'
      const nivelesMap: Record<
        string,
        { id_nivel: number; nombre_nivel: string; inscritos: number }
      > = {};

      area.inscripciones.forEach((insc) => {
        if (!insc.nivel) return;
        const nivelIdStr = insc.nivel.id_nivel.toString();
        if (!nivelesMap[nivelIdStr]) {
          nivelesMap[nivelIdStr] = {
            id_nivel: Number(insc.nivel.id_nivel),
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
        nota_aprobacion: area.nota_aprobacion,
        tipo: area.tipo,
        niveles_target: area.niveles_target,
        activo: area.activo,
        niveles: Object.values(nivelesMap),
      };
    });

    return mapped;
  }

  /* =================================================================
   * 2) Estadísticas para PANEL PRINCIPAL
   * ================================================================= */
  async getAreasConEstadisticasPanelPrincipal(): Promise<AreaNivelStats[]> {
    console.log('💡 Iniciando consulta a Prisma (panel principal)...');

    const NIVELES_PERMITIDOS = ['PRIMARIA', 'SECUNDARIA'];

    // 1. Consulta inicial
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

    // --- Preparación ---
    const areaNivelKeys = new Set<string>();
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

    const areaIds = Array.from(
      new Set(Array.from(areaNivelKeys).map((k) => Number(k.split('-')[0]))),
    );
    const nivelIds = Array.from(
      new Set(Array.from(areaNivelKeys).map((k) => Number(k.split('-')[1]))),
    );

    // 2. Consultar FASES
    const fases = await this.prisma.fases.findMany({
      orderBy: { orden_fase: 'asc' },
      select: { id_fase: true, orden_fase: true },
    });

    // 3. Consultar CIERRES
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

    // 4. Mapear estados
    const estadoPorAreaNivel = new Map<string, estado_area>();

    for (const key of areaNivelKeys) {
      const [id_area, id_nivel] = key.split('-').map(Number);
      const cierresAreaNivel = cierresValidados.filter(
        (c) => c.id_area === id_area && c.id_nivel === id_nivel,
      );

      let estado: estado_area = 'EVALUANDO';

      if (cierresAreaNivel.length > 0) {
        const maxOrdenFaseCerrada = cierresAreaNivel.reduce(
          (maxOrden, currentCierre) => {
            const currentFase = fases.find(
              (f) => f.id_fase === currentCierre.id_fase,
            );
            return Math.max(maxOrden, currentFase?.orden_fase ?? 0);
          },
          0,
        );

        if (maxOrdenFaseCerrada >= 2) {
          estado = 'COMPLETADO';
        } else if (maxOrdenFaseCerrada >= 1) {
          estado = 'CLASIFICANDO';
        }
      }

      estadoPorAreaNivel.set(key, estado);
    }

    // --- Generación de la Respuesta Final ---
    const combinaciones: AreaNivelStats[] = [];

    areas.forEach((area) => {
      const nivelesMap = new Map<number, number>();

      area.inscripciones.forEach((inscripcion) => {
        if (!inscripcion.nivel) return;
        const idNivel = Number(inscripcion.nivel.id_nivel);
        const nombreNivel = inscripcion.nivel.nombre_nivel?.toUpperCase() ?? '';

        const esNivelPermitido = NIVELES_PERMITIDOS.some((niv) =>
          nombreNivel.includes(niv),
        );
        if (!esNivelPermitido) return;

        nivelesMap.set(idNivel, (nivelesMap.get(idNivel) || 0) + 1);
      });

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

    combinaciones.sort((a, b) => {
      if (a.nombre_area < b.nombre_area) return -1;
      if (a.nombre_area > b.nombre_area) return 1;
      return a.nombre_nivel.localeCompare(b.nombre_nivel);
    });

    console.log('💡 Datos devueltos:', combinaciones.length);
    return combinaciones;
  }

  /* =================================================================
   * 3) FUNCIÓN PRINCIPAL DEL DASHBOARD
   * ================================================================= */
  async getDashboardData(): Promise<DashboardResponse> {
    // 1. Obtener Stats Detalladas
    const areasStats = await this.getAreasConEstadisticasPanelPrincipal();

    // 2. Obtener contadores globales
    const [
      totalRegistrosCount,
      totalEvaluadoresCount,
      totalResponsablesCount,
      areasActivasCount,
      totalClasificadosCount,
      totalPremiadosCount,
    ] = await Promise.all([
      this.prisma.inscripciones.count({}),
      this.prisma.evaluadores_area.count({ where: { activo: true } }),
      this.prisma.responsables_area.count({ where: { activo: true } }),
      this.prisma.areas.count({ where: { activo: true } }),
      this.prisma.inscripciones.count({
        where: { clasificacion: 'CLASIFICADO' },
      }),
      this.prisma.premios_otorgados.count({}),
    ]);

    // 7. Áreas en Evaluación
    const areasEnEvaluacion = areasStats.filter(
      (a) => a.estado === 'EVALUANDO' || a.estado === 'CLASIFICANDO',
    ).length;

    const metrics: DashboardMetrics = {
      totalOlimpiadas: 1,
      totalRegistros: totalRegistrosCount,
      totalAreas: areasActivasCount,
      areasActivas: areasActivasCount,
      totalEvaluadores: totalEvaluadoresCount,
      totalResponsables: totalResponsablesCount,
      totalClasificados: totalClasificadosCount,
      totalPremiados: totalPremiadosCount,
      areasEnEvaluacion: areasEnEvaluacion,
    };

    return {
      metrics,
      areasStats,
    };
  }

  // Ahora además de id_area y nombre_area, devolvemos niveles_target
  // y un array calculado nivelesTarget, que usa el front para filtrar
  // por Primaria / Secundaria.
  findAllActive() {
    return this.prisma.areas
      .findMany({
        where: { activo: true },
        select: {
          id_area: true,
          nombre_area: true,
          niveles_target: true, // <— campo existente en BD
        },
        orderBy: { nombre_area: 'asc' },
      })
      .then((areas) =>
        areas.map((a) => ({
          ...a,
          // Ejemplos válidos en niveles_target:
          nivelesTarget: a.niveles_target
            ? a.niveles_target
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
        })),
      );
  }
}
