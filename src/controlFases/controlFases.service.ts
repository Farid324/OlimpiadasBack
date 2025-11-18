// src/controlFases/controlFases.service.ts
import { Injectable } from '@nestjs/common';
import {
  ControlFasesResponse,
  AccionColor,
  PhaseTypeCF,
  FilaFase,
} from './controlFases.types';
import { PrismaService } from '../prisma/prisma.service';

type Clasificacion = 'CLASIFICADO' | 'NO_CLASIFICADO' | 'DESCALIFICADO';

@Injectable()
export class ControlFasesService {
  constructor(private readonly prisma: PrismaService) {}

  async getControlFases(
    type: PhaseTypeCF = 'CLASIFICACION',
  ): Promise<ControlFasesResponse> {
    const isFinal = type === 'FINAL';

    // 1) Fase que se va a analizar
    const fase = await this.prisma.fases.findFirst({
      where: { nombre_fase: isFinal ? 'FINAL' : 'CLASIFICATORIA' },
      select: { id_fase: true },
    });

    if (!fase) {
      return {
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
            nota: 'del total de evaluaciones completadas',
          },
        },
        filas: [],
      };
    }

    const idFase = fase.id_fase;

    // 2) Agrupación base de inscripciones por área/nivel + clasificación
    const grouped = await this.prisma.inscripciones.groupBy({
      by: ['id_area', 'id_nivel', 'clasificacion'],
      where: isFinal
        ? {
            clasificacion: 'CLASIFICADO',
          }
        : {},
      _count: { _all: true },
    });

    if (grouped.length === 0) {
      return {
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
            nota: 'del total de evaluaciones completadas',
          },
        },
        filas: [],
      };
    }

    // 3) Catálogos
    const areaIds = Array.from(new Set(grouped.map((g) => g.id_area)));
    const nivelIds = Array.from(new Set(grouped.map((g) => g.id_nivel)));

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

    // 4) Mapa (areaId:nivelId) -> conteos por clasificación
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

    for (const g of grouped) {
      const key = `${g.id_area}:${g.id_nivel}`;
      if (!acc.has(key)) {
        acc.set(key, {
          id_area: g.id_area,
          id_nivel: g.id_nivel,
          counts: { ...zeroCounts },
        });
      }
      const bucket = acc.get(key)!;
      const clasif = (g.clasificacion ?? 'NO_CLASIFICADO') as Clasificacion;
      bucket.counts[clasif] = (bucket.counts[clasif] ?? 0) + g._count._all;
    }

    // 5) KPIs globales: evaluaciones de ESTA fase (id_fase)
    const [totalEvaluaciones, completadas] = await Promise.all([
      this.prisma.evaluaciones
        .count({
          where: { id_fase: idFase },
        })
        .catch(() => 0),
      this.prisma.evaluaciones
        .count({
          where: { id_fase: idFase, estado_registro: 'FIRMADA' as any },
        })
        .catch(() => 0),
    ]);

    const progresoGeneral =
      totalEvaluaciones > 0
        ? Math.round((completadas / totalEvaluaciones) * 100)
        : 0;

    // 5.1) Pendientes de CLASIFICACIÓN (solo aplica a fase CLASIFICATORIA)
    const pendMap = new Map<string, number>();
    if (!isFinal) {
      const pendientesGroup = await this.prisma.inscripciones.groupBy({
        by: ['id_area', 'id_nivel'],
        where: { puntaje_clasificacion: null },
        _count: { _all: true },
      });

      for (const p of pendientesGroup) {
        pendMap.set(`${p.id_area}:${p.id_nivel}`, p._count._all);
      }
    }

    // 5.2) Estado de cierre desde cierres_fase para ESTA fase
    const cierres = await this.prisma.cierres_fase.findMany({
      where: { id_fase: idFase },
      select: { id_area: true, id_nivel: true, estado_validacion: true },
    });

    const stateMap = new Map<string, 'EN_PROCESO' | 'CERRADA' | 'VALIDADA'>();

    for (const c of cierres) {
      const st = c.estado_validacion === 'VALIDADO' ? 'VALIDADA' : 'CERRADA';
      stateMap.set(`${c.id_area}:${c.id_nivel}`, st as 'CERRADA' | 'VALIDADA');
    }

    // 6) Construcción de filas
    const filas: FilaFase[] = Array.from(acc.values()).map(
      ({ id_area, id_nivel, counts }) => {
        const area = areaById.get(id_area);
        const nivel = nivelById.get(id_nivel);

        const clasificados = counts.CLASIFICADO;
        const noClasificados = counts.NO_CLASIFICADO;
        const descalificados = counts.DESCALIFICADO;

        const progresoHecho = clasificados + noClasificados + descalificados;
        const progresoTotal = Math.max(progresoHecho, 1);

        const key = `${id_area}:${id_nivel}`;
        const statusFase = (stateMap.get(key) ?? 'EN_PROCESO') as
          | 'EN_PROCESO'
          | 'CERRADA'
          | 'VALIDADA';

        const pend = pendMap.get(key) ?? 0;
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
              : clasificados > 0 && noClasificados === 0 && descalificados === 0
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
          resumen: { clasificados, noClasificados, descalificados },
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

    // 7) KPIs finales
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
