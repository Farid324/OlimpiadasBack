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
  async getMisFases(input: { userId: number | null; email: string | null }) {
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
      // sin usuario => respuesta vacía coherente
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

    // Áreas a cargo del responsable
    const misAreas = await this.prisma.responsables_area.findMany({
      where: { id_usuario: userId, activo: true },
      select: { id_area: true },
    });

    if (misAreas.length === 0) {
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

    const areaIds = misAreas.map(a => a.id_area);

    // Conteos por (área, nivel, clasificacion) sólo en MIS áreas
    const grouped = await this.prisma.inscripciones.groupBy({
      by: ['id_area', 'id_nivel', 'clasificacion'],
      where: { id_area: { in: areaIds } },
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

    // Catálogos
    const nivelIds = Array.from(new Set(grouped.map(g => g.id_nivel)));
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

    const areaById = new Map(areas.map(a => [a.id_area, a]));
    const nivelById = new Map(niveles.map(n => [n.id_nivel, n]));
    const miNombre =
      [yo?.nombre, yo?.apellido].filter(Boolean).join(' ').trim() || '—';

    // cmap por (area:nivel)
    const zero: Record<Clasificacion, number> = {
      CLASIFICADO: 0,
      NO_CLASIFICADO: 0,
      DESCALIFICADO: 0,
    };

    const acc = new Map<
      string,
      { id_area: number; id_nivel: number; counts: Record<Clasificacion, number> }
    >();

    for (const g of grouped) {
      const key = `${g.id_area}:${g.id_nivel}`;
      if (!acc.has(key)) {
        acc.set(key, { id_area: g.id_area, id_nivel: g.id_nivel, counts: { ...zero } });
      }
      const c = (g.clasificacion ?? 'NO_CLASIFICADO') as Clasificacion;
      acc.get(key)!.counts[c] = (acc.get(key)!.counts[c] ?? 0) + g._count._all;
    }

    // Pendientes (puntaje_clasificacion = null)
    const pendientesGroup = await this.prisma.inscripciones.groupBy({
      by: ['id_area', 'id_nivel'],
      where: { id_area: { in: areaIds }, puntaje_clasificacion: null },
      _count: { _all: true },
    });
    const pendMap = new Map<string, number>(
      pendientesGroup.map(p => [`${p.id_area}:${p.id_nivel}`, p._count._all]),
    );

    // Fase clasificatoria (para cierres/validaciones si existen)
    const faseClasif = await this.prisma.fases.findFirst({
      where: { nombre_fase: 'CLASIFICATORIA' },
      select: { id_fase: true },
    });

    let stateMap = new Map<string, 'EN_PROCESO' | 'CERRADA' | 'VALIDADA'>();
    if (faseClasif) {
      const cierres = await this.prisma.cierres_fase.findMany({
        where: { id_fase: faseClasif.id_fase, id_area: { in: areaIds } },
        select: { id_area: true, id_nivel: true, estado_validacion: true },
      });
      stateMap = new Map(
        cierres.map(c => {
          const st = c.estado_validacion === 'VALIDADO' ? 'VALIDADA' : 'CERRADA';
          return [`${c.id_area}:${c.id_nivel}`, st as 'CERRADA' | 'VALIDADA'];
        }),
      );
    }

    // Construcción de filas
    const filas = Array.from(acc.values()).map(({ id_area, id_nivel, counts }) => {
      const area = areaById.get(id_area);
      const nivel = nivelById.get(id_nivel);

      const clasificados = counts.CLASIFICADO;
      const noClasificados = counts.NO_CLASIFICADO;
      const descalificados = counts.DESCALIFICADO;

      const progresoHecho = clasificados + noClasificados + descalificados;
      const progresoTotal = Math.max(progresoHecho, 1);

      const statusFase = (stateMap.get(`${id_area}:${id_nivel}`) ??
        'EN_PROCESO') as 'EN_PROCESO' | 'CERRADA' | 'VALIDADA';

      const pend = pendMap.get(`${id_area}:${id_nivel}`) ?? 0;
      const sinPendientes = pend === 0;

      const faseActual: 'Clasificación' | 'Evaluación Final' | 'Completado' =
        progresoHecho === 0
          ? 'Clasificación'
          : clasificados > 0 && noClasificados === 0 && descalificados === 0
          ? 'Completado'
          : 'Evaluación Final';

      let estadoUI: 'En progreso' | 'Completado' | 'Listo para aprobar';
      if (statusFase === 'CERRADA' || statusFase === 'VALIDADA') {
        estadoUI = 'Completado';
      } else if (clasificados > 0 && sinPendientes) {
        estadoUI = 'Listo para aprobar';
      } else {
        estadoUI = 'En progreso';
      }

      const accion =
        statusFase === 'CERRADA'
          ? { label: 'Fase cerrada', color: 'neutral' as const, disabled: true }
          : statusFase === 'VALIDADA'
          ? { label: 'Fase validada', color: 'success' as const, disabled: true }
          : estadoUI === 'Listo para aprobar'
          ? { label: 'Aprobar Clasificación', color: 'primary' as const, disabled: false }
          : { label: 'En progreso', color: 'neutral' as const, disabled: true };

      return {
        id: `${id_area}-${id_nivel}`,
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
        accionLabel: accion.label,
        accionColor: accion.color,
        accionDisabled: accion.disabled,
      };
    });

    // KPIs
    const totalEvaluaciones = await this.prisma.evaluaciones.count({
      where: { inscripcion: { id_area: { in: areaIds } } },
    });
    const completadas = await this.prisma.evaluaciones.count({
      where: {
        inscripcion: { id_area: { in: areaIds } },
        estado_registro: 'FIRMADA' as any,
      },
    });
    const progresoGeneral =
      totalEvaluaciones > 0 ? Math.round((completadas / totalEvaluaciones) * 100) : 0;

    return {
      kpis: {
        evaluacionesCompletadas: { valor: completadas, total: totalEvaluaciones },
        fasesCompletadas: {
          valor: filas.filter(
            f => f.estado === 'Completado' || f.accionLabel === 'Fase validada' || f.accionLabel === 'Fase cerrada',
          ).length,
          total: filas.length,
        },
        aprobacionesPendientes: {
          valor: filas.filter(f => f.estado === 'Listo para aprobar').length,
          nota: 'requiere revisión',
        },
        progresoGeneral: { porcentaje: progresoGeneral, nota: 'del total completado' },
      },
      filas,
    };
  }
}
