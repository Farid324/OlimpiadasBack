// src/controlFases/controlFases.service.ts
import { Injectable } from '@nestjs/common';
import {
  ControlFasesResponse,
  AccionColor,
  PhaseTypeCF,
  FilaFase,
} from './controlFases.types';
import { PrismaService } from '../prisma/prisma.service';

// Enum real de la BD
type Clasificacion = 'CLASIFICADO' | 'NO_CLASIFICADO' | 'DESCALIFICADO';

@Injectable()
export class ControlFasesService {
  constructor(private readonly prisma: PrismaService) {}

  async getControlFases(
    type: PhaseTypeCF = 'CLASIFICACION',
  ): Promise<ControlFasesResponse> {
    const isFinal = type === 'FINAL';

    const empty: ControlFasesResponse = {
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
      return empty;
    }

    // 1) Fase que se va a analizar
    const fase = await this.prisma.fases.findFirst({
      where: { nombre_fase: isFinal ? 'FINAL' : 'CLASIFICATORIA' },
      select: { id_fase: true },
    });

    if (!fase) {
      return empty;
    }

    const idFase = fase.id_fase;

    // 2) PARES BASE área/nivel (todas las inscripciones de la gestión):
    //    CLASIFICACIÓN: todas las inscripciones de la gestión
    //    FINAL: solo quienes llegaron a final (clasificacion = CLASIFICADO) en la gestión
    const basePairs = await this.prisma.inscripciones.groupBy({
      by: ['id_area', 'id_nivel'],
      where: isFinal
        ? {
            id_gestion: gestion.id_gestion,
            clasificacion: 'CLASIFICADO',
          }
        : {
            id_gestion: gestion.id_gestion,
          },
      _count: { _all: true },
    });

    if (basePairs.length === 0) {
      return empty;
    }

    // 3) Agrupación SOLO de inscripciones evaluadas para esta fase
    //    CLASIFICACIÓN: puntaje_clasificacion NOT NULL
    //    FINAL: clasificacion = CLASIFICADO y puntaje_final NOT NULL
    const grouped = await this.prisma.inscripciones.groupBy({
      by: ['id_area', 'id_nivel', 'clasificacion'],
      where: isFinal
        ? {
            id_gestion: gestion.id_gestion,
            clasificacion: 'CLASIFICADO',
            puntaje_final: { not: null },
          }
        : {
            id_gestion: gestion.id_gestion,
            puntaje_clasificacion: { not: null },
          },
      _count: { _all: true },
    });

    // 4) Catálogos (tomando los IDs desde basePairs)
    const areaIds = Array.from(new Set(basePairs.map((g) => g.id_area)));
    const nivelIds = Array.from(new Set(basePairs.map((g) => g.id_nivel)));

    const [areas, niveles] = await Promise.all([
      this.prisma.areas.findMany({
        where: { id_area: { in: areaIds } },
        select: { id_area: true, nombre_area: true, estado: true },
      }),
      this.prisma.niveles.findMany({
        where: { id_nivel: { in: nivelIds } },
        select: { id_nivel: true, nombre_nivel: true },
      }),
    ]);

    const areaById = new Map(areas.map((a) => [a.id_area, a]));
    const nivelById = new Map(niveles.map((n) => [n.id_nivel, n]));

    // 5) Mapa (areaId:nivelId) -> conteos por clasificación (SOLO evaluados)
    type Key = string;
    const acc = new Map<
      Key,
      {
        id_area: number;
        id_nivel: number;
        counts: Record<Clasificacion, number>;
      }
    >();

    const zeroCounts: Record<Clasificacion, number> = {
      CLASIFICADO: 0,
      NO_CLASIFICADO: 0,
      DESCALIFICADO: 0,
    };

    // 5.1 Seed: una entrada por cada área/nivel con inscripciones en la gestión
    for (const p of basePairs) {
      const key = `${p.id_area}:${p.id_nivel}`;
      acc.set(key, {
        id_area: p.id_area,
        id_nivel: p.id_nivel,
        counts: { ...zeroCounts },
      });
    }

    // 5.2 Rellenar counts SOLO con evaluados
    for (const g of grouped) {
      const key = `${g.id_area}:${g.id_nivel}`;
      const bucket = acc.get(key);
      if (!bucket) continue;

      const clasif = (g.clasificacion ?? 'NO_CLASIFICADO') as Clasificacion;
      bucket.counts[clasif] = (bucket.counts[clasif] ?? 0) + g._count._all;
    }

    // 6) KPIs globales: evaluaciones de ESTA fase (id_fase) y gestión abierta
    const [totalEvaluaciones, completadas] = await Promise.all([
      this.prisma.evaluaciones
        .count({
          where: {
            id_fase: idFase,
            inscripcion: { id_gestion: gestion.id_gestion },
          },
        })
        .catch(() => 0),
      this.prisma.evaluaciones
        .count({
          where: {
            id_fase: idFase,
            estado_registro: 'FIRMADA' as any,
            inscripcion: { id_gestion: gestion.id_gestion },
          },
        })
        .catch(() => 0),
    ]);

    const progresoGeneral =
      totalEvaluaciones > 0
        ? Math.round((completadas / totalEvaluaciones) * 100)
        : 0;

    // 6.1) Pendientes:
    //      CLASIFICACIÓN: puntaje_clasificacion = NULL
    //      FINAL: clasificacion = CLASIFICADO y puntaje_final = NULL
    const pendMap = new Map<string, number>();
    const pendientesGroup = await this.prisma.inscripciones.groupBy({
      by: ['id_area', 'id_nivel'],
      where: isFinal
        ? {
            id_gestion: gestion.id_gestion,
            clasificacion: 'CLASIFICADO',
            puntaje_final: null,
          }
        : {
            id_gestion: gestion.id_gestion,
            puntaje_clasificacion: null,
          },
      _count: { _all: true },
    });

    for (const p of pendientesGroup) {
      pendMap.set(`${p.id_area}:${p.id_nivel}`, p._count._all);
    }

    // 6.2) Estado de cierre desde cierres_fase para ESTA fase y gestión
    const cierres = await this.prisma.cierres_fase.findMany({
      where: {
        id_fase: idFase,
        id_gestion: gestion.id_gestion,
      },
      select: { id_area: true, id_nivel: true, estado_validacion: true },
    });

    const stateMap = new Map<string, 'EN_PROCESO' | 'CERRADA' | 'VALIDADA'>();

    for (const c of cierres) {
      const st = c.estado_validacion === 'VALIDADO' ? 'VALIDADA' : 'CERRADA';
      stateMap.set(`${c.id_area}:${c.id_nivel}`, st as 'CERRADA' | 'VALIDADA');
    }

    // 7) Construcción de filas
    const filas: FilaFase[] = Array.from(acc.values()).map(
      ({ id_area, id_nivel, counts }) => {
        const area = areaById.get(id_area);
        const nivel = nivelById.get(id_nivel);

        const key = `${id_area}:${id_nivel}`;

        const clasificados = counts.CLASIFICADO;
        const noClasificados = isFinal ? 0 : counts.NO_CLASIFICADO;
        const descalificados = isFinal ? 0 : counts.DESCALIFICADO;

        // "No evaluados" según la fase
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

        // Fase actual en función del tipo
        let faseActual: FilaFase['faseActual'];
        if (isFinal) {
          faseActual =
            statusFase === 'VALIDADA' ? 'Completado' : 'Evaluación Final';
        } else {
          faseActual =
            progresoHecho === 0
              ? 'Clasificación'
              : clasificados > 0 &&
                noClasificados === 0 &&
                descalificados === 0
              ? 'Completado'
              : 'Evaluación Final';
        }

        // Estado UI
        let estadoUI: FilaFase['estado'];
        if (statusFase === 'CERRADA' || statusFase === 'VALIDADA') {
          estadoUI = 'Completado';
        } else if (clasificados > 0 && sinPendientes) {
          estadoUI = 'Listo para aprobar';
        } else {
          estadoUI = 'En progreso';
        }

        // Botón / acción
        let accionLabel: string;
        let accionColor: AccionColor;
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

        const fila: FilaFase = {
          id: `${id_area}-${id_nivel}-${type}`,
          idArea: id_area,
          idNivel: id_nivel,
          area: area?.nombre_area ?? `Área ${id_area}`,
          nivel: nivel?.nombre_nivel ?? `Nivel ${id_nivel}`,
          faseActual,
          progresoHecho,
          progresoTotal,
          resumen: { clasificados, noClasificados, descalificados, noEvaluados },
          responsable: '—', // luego se rellena en el servicio de FE con responsablesApi
          fechaHora: new Date().toISOString().slice(0, 16).replace('T', ' '),
          estado: estadoUI,
          accionLabel,
          accionColor,
          accionDisabled,
        };

        return fila;
      },
    );

    // 8) KPIs finales
    const fasesCompletadas = filas.filter(
      (f) =>
        f.accionLabel === 'Fase validada' ||
        f.accionLabel === 'Fase cerrada' ||
        f.estado === 'Completado',
    ).length;

    const aprobPendientes = filas.filter(
      (f) => f.estado === 'Listo para aprobar',
    ).length;

    const resp: ControlFasesResponse = {
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

    return resp;
  }
}
