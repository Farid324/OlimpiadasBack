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
          nota: 'del total de evaluaciones completadas',
        },
      },
      filas: [],
    };

    let userId = input.userId;

    // Fallback: si no vino id en el token, intenta buscar por correo
    if (!userId && input.email) {
      const u = await this.prisma.usuarios.findUnique({
        where: { correo: input.email },
        select: { id_usuario: true },
      });
      userId = u?.id_usuario ?? null;
    }

    if (!userId) {
      return emptyResponse;
    }

    // Áreas a cargo del responsable
    const misAreas = await this.prisma.responsables_area.findMany({
      where: { id_usuario: userId, activo: true },
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

    let allowedPairsForFinal = new Set<string>();

    if (isFinal) {
      const faseClasif = await this.prisma.fases.findFirst({
        where: { nombre_fase: 'CLASIFICATORIA' },
        select: { id_fase: true },
      });

      if (!faseClasif) {
        // No hay fase de clasificación definida => no mostramos nada en FINAL
        return emptyResponse;
      }

      const cierresClasif = await this.prisma.cierres_fase.findMany({
        where: {
          id_fase: faseClasif.id_fase,
          id_area: { in: areaIds },
          estado_validacion: 'VALIDADO',
        },
        select: { id_area: true, id_nivel: true },
      });

      allowedPairsForFinal = new Set(
        cierresClasif.map((c) => `${c.id_area}:${c.id_nivel}`),
      );

      // Si no hay ninguna área/nivel con fase CLASIFICATORIA cerrada,
      // entonces la fase FINAL no debe mostrar nada aún.
      if (allowedPairsForFinal.size === 0) {
        return emptyResponse;
      }
    }

    // 2) Agrupación base de inscripciones por área/nivel + clasificación
    const grouped = await this.prisma.inscripciones.groupBy({
      by: ['id_area', 'id_nivel', 'clasificacion'],
      where: isFinal
        ? {
            id_area: { in: areaIds },
            clasificacion: 'CLASIFICADO',
          }
        : {
            id_area: { in: areaIds },
          },
      _count: { _all: true },
    });

    if (grouped.length === 0) {
      return emptyResponse;
    }

    // 3) Catálogos
    const nivelIds = Array.from(new Set(grouped.map((g) => g.id_nivel)));

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

    // 4) Mapa (areaId:nivelId) -> conteos por clasificación
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

    for (const g of grouped) {
      const key = `${g.id_area}:${g.id_nivel}`;
      if (isFinal && !allowedPairsForFinal.has(key)) {
        continue;
      }
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

    if (acc.size === 0) {
      return emptyResponse;
    }

    // 5) KPIs globales: evaluaciones de ESTA fase (id_fase) y SOLO mis áreas
    const [totalEvaluaciones, completadas] = await Promise.all([
      this.prisma.evaluaciones
        .count({
          where: {
            id_fase: idFase,
            inscripcion: { id_area: { in: areaIds } },
          },
        })
        .catch(() => 0),
      this.prisma.evaluaciones
        .count({
          where: {
            id_fase: idFase,
            estado_registro: 'FIRMADA' as any,
            inscripcion: { id_area: { in: areaIds } },
          },
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
        where: {
          id_area: { in: areaIds },
          puntaje_clasificacion: null,
        },
        _count: { _all: true },
      });

      for (const p of pendientesGroup) {
        pendMap.set(`${p.id_area}:${p.id_nivel}`, p._count._all);
      }
    }

    // 5.2) Estado de cierre desde cierres_fase para ESTA fase y mis áreas
    const cierres = await this.prisma.cierres_fase.findMany({
      where: { id_fase: idFase, id_area: { in: areaIds } },
      select: { id_area: true, id_nivel: true, estado_validacion: true },
    });

    const stateMap = new Map<Key, 'EN_PROCESO' | 'CERRADA' | 'VALIDADA'>();

    for (const c of cierres) {
      const st = c.estado_validacion === 'VALIDADO' ? 'VALIDADA' : 'CERRADA';
      stateMap.set(`${c.id_area}:${c.id_nivel}`, st as 'CERRADA' | 'VALIDADA');
    }

    // 6) Construcción de filas
    const filas = Array.from(acc.values()).map(
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

        // Fase actual en función del tipo (igual que admin)
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
        } else if (clasificados > 0 && sinPendientes) {
          estadoUI = 'Listo para aprobar';
        } else {
          estadoUI = 'En progreso';
        }

        // Botón / acción (igual que admin)
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
          resumen: { clasificados, noClasificados, descalificados },
          responsable: miNombre,
          fechaHora: new Date().toISOString().slice(0, 16).replace('T', ' '),
          estado: estadoUI,
          accionLabel,
          accionColor,
          accionDisabled,
        };
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
