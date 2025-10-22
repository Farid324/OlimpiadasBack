import { Injectable } from '@nestjs/common';
import { ControlFasesResponse, AccionColor } from './controlFases.types';
import { PrismaService } from '../prisma/prisma.service';

type Clasificacion = 'CLASIFICADO' | 'NO_CLASIFICADO' | 'DESCALIFICADO';

@Injectable()
export class ControlFasesService {
  constructor(private readonly prisma: PrismaService) {}

  async getControlFases(): Promise<ControlFasesResponse> {
    // 1) Conteos por (área, nivel, clasificacion)
    const grouped = await this.prisma.inscripciones.groupBy({
      by: ['id_area', 'id_nivel', 'clasificacion'],
      _count: { _all: true },
    });

    if (grouped.length === 0) {
      return {
        kpis: {
          evaluacionesCompletadas: { valor: 0, total: 0 },
          fasesCompletadas: { valor: 0, total: 0 },
          aprobacionesPendientes: { valor: 0, nota: 'requiere revisión' },
          progresoGeneral: { porcentaje: 0, nota: 'del total completado' },
        },
        filas: [],
      };
    }

    // 2) Catálogos usados
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

    // 3) Mapa (areaId:nivelId) -> conteos
    type Key = string;
    const acc = new Map<
      Key,
      { id_area: number; id_nivel: number; counts: Record<Clasificacion, number> }
    >();

    const zero: Record<Clasificacion, number> = {
      CLASIFICADO: 0,
      NO_CLASIFICADO: 0,
      DESCALIFICADO: 0,
    };

    for (const g of grouped) {
      const key = `${g.id_area}:${g.id_nivel}`;
      if (!acc.has(key)) {
        acc.set(key, { id_area: g.id_area, id_nivel: g.id_nivel, counts: { ...zero } });
      }
      const bucket = acc.get(key)!;
      const c = (g.clasificacion ?? 'NO_CLASIFICADO') as Clasificacion;
      bucket.counts[c] = (bucket.counts[c] ?? 0) + g._count._all;
    }

    // 4) KPIs globales desde evaluaciones (FIRMADA = completada)
    const [totalEvaluaciones, completadas] = await Promise.all([
      this.prisma.evaluaciones.count(),
      this.prisma.evaluaciones.count({ where: { estado_registro: 'FIRMADA' } }),
    ]);

    const progresoGeneral =
      totalEvaluaciones > 0 ? Math.round((completadas / totalEvaluaciones) * 100) : 0;

    // 5) Filas tipadas explícitamente
    const filas: ControlFasesResponse['filas'] = Array.from(acc.values()).map(
      ({ id_area, id_nivel, counts }) => {
        const area = areaById.get(id_area);
        const nivel = nivelById.get(id_nivel);

        const clasificados = counts.CLASIFICADO;
        const noClasificados = counts.NO_CLASIFICADO;
        const descalificados = counts.DESCALIFICADO;

        const progresoHecho = clasificados + noClasificados + descalificados;
        const progresoTotal = Math.max(progresoHecho, 1);

        const faseActual:
          | 'Clasificación'
          | 'Evaluación Final'
          | 'Completado' =
          progresoHecho === 0
            ? 'Clasificación'
            : clasificados > 0 && noClasificados === 0 && descalificados === 0
            ? 'Completado'
            : 'Evaluación Final';

        const estadoUI: 'En progreso' | 'Completado' | 'Listo para aprobar' =
          faseActual === 'Completado'
            ? 'Completado'
            : clasificados > 0
            ? 'Listo para aprobar'
            : 'En progreso';

        const accion =
          estadoUI === 'Completado'
            ? { label: 'Completado', color: 'success' as AccionColor, disabled: true }
            : estadoUI === 'Listo para aprobar'
            ? {
                label: 'Aprobar Clasificación',
                color: 'primary' as AccionColor,
                disabled: false,
              }
            : { label: 'En progreso', color: 'neutral' as AccionColor, disabled: true };

        return {
          id: `${id_area}-${id_nivel}`,
          area: area?.nombre_area ?? `Área ${id_area}`,
          nivel: nivel?.nombre_nivel ?? `Nivel ${id_nivel}`,
          faseActual,
          progresoHecho,
          progresoTotal,
          resumen: {
            clasificados,
            noClasificados,
            descalificados,
          },
          responsable: '—',
          fechaHora: new Date().toISOString().slice(0, 16).replace('T', ' '),
          estado: estadoUI,
          accionLabel: accion.label,
          accionColor: accion.color,
          accionDisabled: accion.disabled,
        };
      },
    );

    // 6) Respuesta final perfectamente tipada
    const resp: ControlFasesResponse = {
      kpis: {
        evaluacionesCompletadas: { valor: completadas, total: totalEvaluaciones },
        fasesCompletadas: {
          valor: filas.filter((f) => f.faseActual === 'Completado').length,
          total: filas.length,
        },
        aprobacionesPendientes: {
          valor: filas.filter((f) => f.estado === 'Listo para aprobar').length,
          nota: 'requiere revisión',
        },
        progresoGeneral: { porcentaje: progresoGeneral, nota: 'del total completado' },
      },
      filas,
    };

    return resp;
  }
}
