//src/controlFases/responsable/controlFasesResp.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type Clasificacion = 'CLASIFICADO' | 'NO_CLASIFICADO' | 'DESCALIFICADO';

@Injectable()
export class ControlFasesRespService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene filas y KPIs para las áreas a cargo del responsable.
   * @param input.userId  id del usuario (si viene en el JWT)
   * @param input.email   correo del usuario (fallback para buscar id)
   */
  async getMisFases(input: {
    userId: number | null;
    email: string | null;
    type: 'CLASIFICACION' | 'FINAL';
  }) {
    const isFinal = input.type === 'FINAL';

    const emptyResponse = {
      kpis: {
        evaluacionesCompletadas: { valor: 0, total: 0 },
        fasesCompletadas: { valor: 0, total: 0 },
        aprobacionesPendientes: {
          valor: 0,
          nota: isFinal
            ? 'Fases finales pendientes de revisión'
            : 'Fases clasificatorias pendientes de revisión',
        },
        progresoGeneral: {
          porcentaje: 0,
          nota: 'del total de evaluaciones firmadas',
        },
      },
      filas: [],
    };

    // Gestión abierta
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' },
      select: { id_gestion: true },
    });
    if (!gestion) {
      return emptyResponse;
    }

    let userId = input.userId;

    // Fallback: solo si el correo corresponde a un responsable ACTIVO en la gestión ABIERTA
    if (!userId && input.email) {
      const responsableActual = await this.prisma.responsables_area.findFirst({
        where: {
          activo: true,
          id_gestion: gestion.id_gestion,
          usuario: {
            correo: input.email,
          },
        },
        select: { id_usuario: true },
      });

      userId = responsableActual?.id_usuario ?? null;
    }

    if (!userId) {
      return emptyResponse;
    }

    // Áreas a cargo del responsable (ligadas a la gestión)
    const misAreas = await this.prisma.responsables_area.findMany({
      where: {
        id_usuario: userId,
        activo: true,
        id_gestion: gestion.id_gestion,
      },
      select: { id_area: true },
    });

    if (misAreas.length === 0) {
      return emptyResponse;
    }

    const areaIds = misAreas.map((a) => a.id_area);

    // 1) Fase que se va a analizar
    const fase = await this.prisma.fases.findFirst({
      where: { nombre_fase: isFinal ? 'FINAL' : 'CLASIFICATORIA' },
      select: { id_fase: true },
    });

    if (!fase) {
      return emptyResponse;
    }

    const idFase = fase.id_fase;

    // FINAL: limitar a pares área/nivel cuya CLASIFICACIÓN esté VALIDADA
    let allowedPairsForFinal = new Set<string>();

    if (isFinal) {
      const faseClasif = await this.prisma.fases.findFirst({
        where: { nombre_fase: 'CLASIFICATORIA' },
        select: { id_fase: true },
      });

      if (!faseClasif) {
        return emptyResponse;
      }

      const cierresClasif = await this.prisma.cierres_fase.findMany({
        where: {
          id_fase: faseClasif.id_fase,
          id_area: { in: areaIds },
          id_gestion: gestion.id_gestion,
          estado_validacion: 'VALIDADO',
        },
        select: { id_area: true, id_nivel: true },
      });

      allowedPairsForFinal = new Set(
        cierresClasif.map((c) => `${c.id_area}:${c.id_nivel}`),
      );

      if (allowedPairsForFinal.size === 0) {
        return emptyResponse;
      }
    }

    // 2) PARES BASE área/nivel (todas las "materias" con inscripciones del responsable en la gestión)
    // CLASIFICACION: todas las inscripciones de mis áreas en la gestión
    // FINAL: solo los que llegaron a final (clasificados) en mis áreas y gestión
    const basePairs = await this.prisma.inscripciones.groupBy({
      by: ['id_area', 'id_nivel'],
      where: isFinal
        ? {
            id_area: { in: areaIds },
            id_gestion: gestion.id_gestion,
            clasificacion: 'CLASIFICADO',
          }
        : {
            id_area: { in: areaIds },
            id_gestion: gestion.id_gestion,
          },
      _count: { _all: true },
    });

    if (basePairs.length === 0) {
      return emptyResponse;
    }

    // 3) Agrupación SOLO de evaluados:
    // CLASIFICACION: puntaje_clasificacion NOT NULL
    // FINAL: clasificacion=CLASIFICADO y puntaje_final NOT NULL
    const grouped = await this.prisma.inscripciones.groupBy({
      by: ['id_area', 'id_nivel', 'clasificacion'],
      where: isFinal
        ? {
            id_area: { in: areaIds },
            id_gestion: gestion.id_gestion,
            clasificacion: 'CLASIFICADO',
            puntaje_final: { not: null },
          }
        : {
            id_area: { in: areaIds },
            id_gestion: gestion.id_gestion,
            puntaje_clasificacion: { not: null },
          },
      _count: { _all: true },
    });

    // 4) Para fase FINAL, saber si existe al menos un puntaje_final
    // por cada área/nivel donde haya clasificados.
    let finalScoresByKey = new Map<string, number>();

    if (isFinal) {
      const finales = await this.prisma.inscripciones.groupBy({
        by: ['id_area', 'id_nivel'],
        where: {
          id_area: { in: areaIds },
          id_gestion: gestion.id_gestion,
          clasificacion: 'CLASIFICADO',
          puntaje_final: { not: null },
        },
        _count: { _all: true },
      });

      finalScoresByKey = new Map(
        finales.map((f) => [`${f.id_area}:${f.id_nivel}`, f._count._all]),
      );
    }

    // 5) Catálogos (niveles a partir de basePairs, NO de grouped)
    const nivelIds = Array.from(new Set(basePairs.map((g) => g.id_nivel)));

    const [areas, niveles, yo] = await Promise.all([
      this.prisma.areas.findMany({
        where: { id_area: { in: areaIds } },
        select: { id_area: true, nombre_area: true, estado: true },
      }),
      this.prisma.niveles.findMany({
        where: { id_nivel: { in: nivelIds } },
        select: { id_nivel: true, nombre_nivel: true },
      }),
      this.prisma.usuarios.findUnique({
        where: { id_usuario: userId },
        select: { nombre: true, apellido: true },
      }),
    ]);

    const areaById = new Map(areas.map((a) => [a.id_area, a]));
    const nivelById = new Map(niveles.map((n) => [n.id_nivel, n]));
    const miNombre =
      [yo?.nombre, yo?.apellido].filter(Boolean).join(' ').trim() || '—';

    // 6) Mapa (areaId:nivelId) -> conteos por clasificación
    type Key = string;
    const zeroCounts: Record<Clasificacion, number> = {
      CLASIFICADO: 0,
      NO_CLASIFICADO: 0,
      DESCALIFICADO: 0,
    };

    const acc = new Map<
      Key,
      {
        id_area: number;
        id_nivel: number;
        counts: Record<Clasificacion, number>;
      }
    >();

    // 6.1 Seed: crear entrada para CADA materia (par área/nivel)
    for (const p of basePairs) {
      const key = `${p.id_area}:${p.id_nivel}`;

      // En FINAL solo mostramos pares permitidos por cierres de CLASIFICACIÓN
      if (isFinal && !allowedPairsForFinal.has(key)) {
        continue;
      }

      acc.set(key, {
        id_area: p.id_area,
        id_nivel: p.id_nivel,
        counts: { ...zeroCounts },
      });
    }

    if (acc.size === 0) {
      return emptyResponse;
    }

    // 6.2 Rellenar counts SOLO con evaluados
    for (const g of grouped) {
      const key = `${g.id_area}:${g.id_nivel}`;
      const bucket = acc.get(key);
      if (!bucket) continue; // puede ser un par fuera de allowedPairs en FINAL

      const clasif = (g.clasificacion ?? 'NO_CLASIFICADO') as Clasificacion;
      bucket.counts[clasif] = (bucket.counts[clasif] ?? 0) + g._count._all;
    }

    // 7) KPIs globales: evaluaciones de ESTA fase (id_fase) y SOLO mis áreas en la gestión
    const [totalEvaluaciones, completadas] = await Promise.all([
      this.prisma.evaluaciones
        .count({
          where: {
            id_fase: idFase,
            inscripcion: {
              id_area: { in: areaIds },
              id_gestion: gestion.id_gestion,
            },
          },
        })
        .catch(() => 0),
      this.prisma.evaluaciones
        .count({
          where: {
            id_fase: idFase,
            estado_registro: 'FIRMADA' as any,
            inscripcion: {
              id_area: { in: areaIds },
              id_gestion: gestion.id_gestion,
            },
          },
        })
        .catch(() => 0),
    ]);

    const progresoGeneral =
      totalEvaluaciones > 0
        ? Math.round((completadas / totalEvaluaciones) * 100)
        : 0;

    // 8) Pendientes:
    // CLASIFICACION: puntaje_clasificacion = NULL
    // FINAL: clasificacion=CLASIFICADO y puntaje_final = NULL
    const pendMap = new Map<string, number>();
    const pendientesGroup = await this.prisma.inscripciones.groupBy({
      by: ['id_area', 'id_nivel'],
      where: isFinal
        ? {
            id_area: { in: areaIds },
            id_gestion: gestion.id_gestion,
            clasificacion: 'CLASIFICADO',
            puntaje_final: null,
          }
        : {
            id_area: { in: areaIds },
            id_gestion: gestion.id_gestion,
            puntaje_clasificacion: null,
          },
      _count: { _all: true },
    });

    for (const p of pendientesGroup) {
      pendMap.set(`${p.id_area}:${p.id_nivel}`, p._count._all);
    }

    // 9) Estado de cierre desde cierres_fase para ESTA fase y mis áreas en la gestión
    const cierres = await this.prisma.cierres_fase.findMany({
      where: {
        id_fase: idFase,
        id_area: { in: areaIds },
        id_gestion: gestion.id_gestion,
      },
      select: { id_area: true, id_nivel: true, estado_validacion: true },
    });

    const stateMap = new Map<Key, 'EN_PROCESO' | 'CERRADA' | 'VALIDADA'>();

    for (const c of cierres) {
      const st = c.estado_validacion === 'VALIDADO' ? 'VALIDADA' : 'CERRADA';
      stateMap.set(`${c.id_area}:${c.id_nivel}`, st as 'CERRADA' | 'VALIDADA');
    }

    // 10) Construcción de filas
    const filas = Array.from(acc.values()).map(
      ({ id_area, id_nivel, counts }) => {
        const area = areaById.get(id_area);
        const nivel = nivelById.get(id_nivel);

        const key = `${id_area}:${id_nivel}`;

        const clasificados = counts.CLASIFICADO;
        const noClasificados = isFinal ? 0 : counts.NO_CLASIFICADO;
        const descalificados = isFinal ? 0 : counts.DESCALIFICADO;

        // "No evaluados":
        // - CLASIFICACION: sin puntaje_clasificacion
        // - FINAL: clasificados sin puntaje_final
        const pend = pendMap.get(key) ?? 0;
        const noEvaluados = pend;

        const progresoHecho =
          clasificados + noClasificados + descalificados + noEvaluados;
        const progresoTotal = Math.max(progresoHecho, 1);

        const statusFase = (stateMap.get(key) ?? 'EN_PROCESO') as
          | 'EN_PROCESO'
          | 'CERRADA'
          | 'VALIDADA';

        const sinPendientes = pend === 0;

        const tienePuntajeFinal =
          isFinal && finalScoresByKey.size > 0
            ? (finalScoresByKey.get(key) ?? 0) > 0
            : !isFinal;

        // Fase actual en función del tipo
        let faseActual: 'Clasificación' | 'Evaluación Final' | 'Completado';

        if (isFinal) {
          faseActual =
            statusFase === 'VALIDADA' ? 'Completado' : 'Evaluación Final';
        } else {
          faseActual =
            progresoHecho === 0
              ? 'Clasificación'
              : clasificados > 0 && noClasificados === 0 && descalificados === 0
                ? 'Completado'
                : 'Evaluación Final';
        }

        // Estado UI
        let estadoUI: 'En progreso' | 'Completado' | 'Listo para aprobar';
        if (statusFase === 'CERRADA' || statusFase === 'VALIDADA') {
          estadoUI = 'Completado';
        } else if (isFinal) {
          if (clasificados > 0 && tienePuntajeFinal) {
            estadoUI = 'Listo para aprobar';
          } else {
            estadoUI = 'En progreso';
          }
        } else {
          if (clasificados > 0 && sinPendientes) {
            estadoUI = 'Listo para aprobar';
          } else {
            estadoUI = 'En progreso';
          }
        }

        // Botón / acción
        let accionLabel: string;
        let accionColor: 'primary' | 'neutral' | 'success';
        let accionDisabled = false;

        if (statusFase === 'CERRADA') {
          accionLabel = 'Fase cerrada';
          accionColor = 'neutral';
          accionDisabled = true;
        } else if (statusFase === 'VALIDADA') {
          accionLabel = 'Fase validada';
          accionColor = 'success';
          accionDisabled = true;
        } else if (estadoUI === 'Listo para aprobar') {
          accionLabel = isFinal
            ? 'Aprobar Fase Final'
            : 'Aprobar Clasificación';
          accionColor = 'primary';
        } else {
          accionLabel = 'En progreso';
          accionColor = 'neutral';
          accionDisabled = true;
        }

        return {
          id: `${id_area}-${id_nivel}-${input.type}`,
          idArea: id_area,
          idNivel: id_nivel,
          area: area?.nombre_area ?? `Área ${id_area}`,
          nivel: nivel?.nombre_nivel ?? `Nivel ${id_nivel}`,
          faseActual,
          progresoHecho,
          progresoTotal,
          resumen: {
            clasificados,
            noClasificados,
            descalificados,
            noEvaluados,
          },
          responsable: miNombre,
          fechaHora: new Date().toISOString().slice(0, 16).replace('T', ' '),
          estado: estadoUI,
          accionLabel,
          accionColor,
          accionDisabled,
        };
      },
    );

    // 11) KPIs finales
    const fasesCompletadas = filas.filter(
      (f) =>
        f.accionLabel === 'Fase validada' ||
        f.accionLabel === 'Fase cerrada' ||
        f.estado === 'Completado',
    ).length;

    const aprobPendientes = filas.filter(
      (f) => f.estado === 'Listo para aprobar',
    ).length;

    return {
      kpis: {
        evaluacionesCompletadas: {
          valor: completadas,
          total: totalEvaluaciones,
        },
        fasesCompletadas: {
          valor: fasesCompletadas,
          total: filas.length,
        },
        aprobacionesPendientes: {
          valor: aprobPendientes,
          nota: isFinal
            ? 'Fases finales listas para aprobar'
            : 'Fases clasificatorias listas para aprobar',
        },
        progresoGeneral: {
          porcentaje: progresoGeneral,
          nota: 'del total de evaluaciones firmadas',
        },
      },
      filas,
    };
  }
}
