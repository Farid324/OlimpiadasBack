// src/principal/principal.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompetidorListadoDto, MedalleroResumenDto } from './dto';
import {
  tipo_premio,
  estado_inscripcion,
  gestiones,
  estado_validacion,
  Prisma,
} from '@prisma/client';

// Tipo con includes completos (agregamos nivel)
type InscripcionIncluida = Prisma.inscripcionesGetPayload<{
  include: {
    competidor: true;
    area: true;
    nivel: true;
    gestion: true;
    premios: true; // lo dejamos por compatibilidad, pero ya no dependemos de esto
  };
}>;

// Helper type para elegibles (antes del filtro)
type ElegibleTmp = { g: InscripcionIncluida; score: number | null };
// Helper type para elegibles (después del filtro)
type Elegible = { g: InscripcionIncluida; score: number };

// Type guard: NO cambia lógica, solo tipa a TS
function isElegible(x: ElegibleTmp, minScore: number): x is Elegible {
  return (
    typeof x.score === 'number' && !Number.isNaN(x.score) && x.score >= minScore
  );
}

@Injectable()
export class PrincipalService {
  constructor(private prisma: PrismaService) {}

  // --- Obtener gestión activa (ABIERTA)
  async obtenerGestionActiva(): Promise<{ id_gestion: number; anio: number }> {
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' as gestiones['estado'] },
      select: { id_gestion: true, anio: true },
      orderBy: { id_gestion: 'desc' },
    });
    return gestion ?? { id_gestion: 0, anio: new Date().getFullYear() };
  }

  // --- Obtener ids áreas cerradas (Se mantiene para Clasificatoria e Histórico)
  private async getIdsAreasCerradas(
    idGestion: number,
    idFase: number,
  ): Promise<number[]> {
    if (!idGestion) return [];

    const cierresValidados = await this.prisma.cierres_fase.findMany({
      where: {
        id_gestion: idGestion,
        id_fase: idFase,
        estado_validacion: 'VALIDADO' as estado_validacion,
      },
      select: { id_area: true },
      distinct: ['id_area'],
    });

    return cierresValidados.map((c) => c.id_area);
  }

  // ============================
  // Helpers para PREMIOS FINAL
  // ============================

  private async getMinScoreFinal(id_area: number): Promise<number> {
    const areaCfg = await this.prisma.areas.findUnique({
      where: { id_area },
      select: {
        nota_aprobacion: true,
        nota_aprobacion_final: true,
      },
    });

    // mismo criterio que tu PremiadosService
    return areaCfg?.nota_aprobacion_final ?? areaCfg?.nota_aprobacion ?? 51;
  }

  private async getMedalleroCfg(
    id_gestion: number,
    id_area: number,
    id_nivel: number,
  ): Promise<{
    oro: number;
    plata: number;
    bronce: number;
    menciones: number;
  }> {
    const medallero = await this.prisma.medallero_config.findFirst({
      where: { id_gestion, id_area, id_nivel },
      orderBy: { id_medallero: 'desc' },
    });

    return {
      oro: medallero?.oros ?? 1,
      plata: medallero?.platas ?? 1,
      bronce: medallero?.bronces ?? 1,
      menciones: medallero?.menciones ?? 0,
    };
  }

  private premioPorPosicion(
    pos: number,
    cfg: { oro: number; plata: number; bronce: number; menciones: number },
  ): tipo_premio | null {
    if (pos <= cfg.oro) return 'ORO';
    if (pos <= cfg.oro + cfg.plata) return 'PLATA';
    if (pos <= cfg.oro + cfg.plata + cfg.bronce) return 'BRONCE';
    if (pos <= cfg.oro + cfg.plata + cfg.bronce + cfg.menciones)
      return 'MENCION';
    return null;
  }

  // --- Mapper: ahora incluye NIVEL y permite forzar medal
  private mapInscripcionToDto(
    inscripcion: InscripcionIncluida,
    faseActual: 'CLASIFICATORIA' | 'FINAL',
    medalOverride?: tipo_premio | null,
  ): CompetidorListadoDto & { level?: string } {
    const puntajeClasificacion = inscripcion.puntaje_clasificacion
      ? Number(inscripcion.puntaje_clasificacion.toString())
      : null;

    const puntajeFinal = inscripcion.puntaje_final
      ? Number(inscripcion.puntaje_final.toString())
      : null;

    const puntaje: number | null =
      faseActual === 'CLASIFICATORIA'
        ? puntajeClasificacion
        : (puntajeFinal ?? puntajeClasificacion);

    // Medalla:
    // - En FINAL usamos medalOverride (calculada)
    // - Si no viene override, intentamos leer premios FINAL (fallback)
    let medalla: tipo_premio | null = null;

    if (faseActual === 'FINAL') {
      if (typeof medalOverride !== 'undefined') {
        medalla = medalOverride;
      } else {
        const premiosFinal =
          inscripcion.premios?.filter((p) => p.fuente === 'FINAL') ?? [];
        const premio =
          premiosFinal.length > 0
            ? premiosFinal[0]
            : (inscripcion.premios?.[0] ?? null);
        medalla = premio?.tipo ?? null;
      }
    }

    return {
      idInscripcion: inscripcion.id_inscripcion,
      name: `${inscripcion.competidor?.nombres ?? 'N/A'} ${
        inscripcion.competidor?.apellidos ?? ''
      }`.trim(),
      ci: inscripcion.competidor?.ci ?? 'N/A',
      area: inscripcion.area?.nombre_area ?? 'N/A',
      // NUEVO: para tu tabla "Nivel"
      level: inscripcion.nivel?.nombre_nivel ?? 'N/A',
      school: inscripcion.competidor?.escuela ?? null,
      city: inscripcion.competidor?.departamento ?? null,
      year: inscripcion.gestion?.anio ?? 0,
      score: puntaje,
      medal: medalla,
      status: inscripcion.estado_inscripcion,
    };
  }

  // --------------------- ENDPOINTS ----------------------

  async getCompetidoresClasificatoria(
    idArea?: number,
  ): Promise<(CompetidorListadoDto & { level?: string })[]> {
    const { id_gestion: idGestion } = await this.obtenerGestionActiva();

    const faseClasificatoria = await this.prisma.fases.findFirst({
      where: { nombre_fase: 'Clasificatoria' },
    });
    const idFaseClasif = faseClasificatoria?.id_fase ?? 1;

    const idAreasCerradas = await this.getIdsAreasCerradas(
      idGestion,
      idFaseClasif,
    );
    if (idAreasCerradas.length === 0 && !idArea) return [];

    const where: Prisma.inscripcionesWhereInput = {
      id_gestion: idGestion,
      puntaje_clasificacion: { not: null },
    };

    if (idArea) where.id_area = idArea;
    else where.id_area = { in: idAreasCerradas };

    const inscripciones: InscripcionIncluida[] =
      await this.prisma.inscripciones.findMany({
        where,
        orderBy: { puntaje_clasificacion: 'desc' },
        include: {
          competidor: true,
          area: true,
          nivel: true,
          gestion: true,
          premios: true,
        },
      });

    return inscripciones.map((i) =>
      this.mapInscripcionToDto(i, 'CLASIFICATORIA'),
    );
  }

  /**
   * FASE FINAL (PUBLIC): ahora calcula medallas/menciones con medallero_config
   * para que NO salga N/A aunque no existan registros en premios_otorgados.
   */
  async getCompetidoresFaseFinal(
    idArea?: number,
    medallaTipo?: tipo_premio | null,
  ): Promise<(CompetidorListadoDto & { level?: string })[]> {
    const { id_gestion: idGestion } = await this.obtenerGestionActiva();

    const where: Prisma.inscripcionesWhereInput = {
      id_gestion: idGestion,
      clasificacion: 'CLASIFICADO',
      puntaje_final: { not: null },
    };

    if (idArea) where.id_area = idArea;

    const inscripciones: InscripcionIncluida[] =
      await this.prisma.inscripciones.findMany({
        where,
        // orden base, luego agrupamos por área/nivel
        orderBy: [
          { id_area: 'asc' },
          { id_nivel: 'asc' },
          { puntaje_final: 'desc' },
        ],
        include: {
          competidor: true,
          area: true,
          nivel: true,
          gestion: true,
          premios: true,
        },
      });

    // Agrupar por area+nivel
    const groups = new Map<string, InscripcionIncluida[]>();
    for (const it of inscripciones) {
      const key = `${it.id_area}|${it.id_nivel}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(it);
    }

    const salida: Array<CompetidorListadoDto & { level?: string }> = [];

    for (const [, grupo] of groups) {
      const id_area = grupo[0].id_area;
      const id_nivel = grupo[0].id_nivel;

      const minScore = await this.getMinScoreFinal(id_area);
      const cfg = await this.getMedalleroCfg(idGestion, id_area, id_nivel);

      // Solo quienes cumplen nota mínima
      const elegibles = grupo
        .map<ElegibleTmp>((g) => {
          const score = g.puntaje_final
            ? Number(g.puntaje_final.toString())
            : null;
          return { g, score };
        })
        .filter((x): x is Elegible => isElegible(x, minScore))
        .sort(
          (a, b) =>
            b.score - a.score || a.g.id_inscripcion - b.g.id_inscripcion,
        );

      let pos = 0;
      for (const item of elegibles) {
        pos += 1;
        const medal = this.premioPorPosicion(pos, cfg);
        if (!medal) continue;

        // filtro por medalla (si viene)
        if (medallaTipo && medal !== medallaTipo) continue;

        salida.push(this.mapInscripcionToDto(item.g, 'FINAL', medal));
      }
    }

    return salida;
  }

  async getCompetidoresHistorico(
    anio: number,
    idArea?: number,
    medallaTipo?: tipo_premio | null,
  ): Promise<(CompetidorListadoDto & { level?: string })[]> {
    const gests = await this.prisma.gestiones.findMany({
      where: { anio, estado: 'CERRADA' },
      select: { id_gestion: true },
    });

    if (gests.length === 0) return [];

    const idGestiones = gests.map((g) => g.id_gestion);

    const where: Prisma.inscripcionesWhereInput = {
      id_gestion: { in: idGestiones },
      estado_inscripcion: {
        in: [estado_inscripcion.FINALISTA, estado_inscripcion.PREMIADO],
      },
    };

    if (idArea) where.id_area = idArea;

    if (medallaTipo) {
      where.premios = {
        some: { tipo: medallaTipo, id_gestion: { in: idGestiones } },
      };
    }

    const inscripciones: InscripcionIncluida[] =
      await this.prisma.inscripciones.findMany({
        where,
        orderBy: [{ puntaje_final: 'desc' }, { puntaje_clasificacion: 'desc' }],
        include: {
          competidor: true,
          area: true,
          nivel: true,
          gestion: true,
          premios: true,
        },
      });

    return inscripciones.map((i) => this.mapInscripcionToDto(i, 'FINAL'));
  }

  async getResumenMedallero(): Promise<MedalleroResumenDto> {
    const gestionActiva = await this.obtenerGestionActiva();
    const idGestion = gestionActiva.id_gestion;

    if (!idGestion) {
      return {
        anio: gestionActiva.anio,
        clasificando: 0,
        medallasOro: 0,
        medallasPlata: 0,
        medallasBronce: 0,
        mencion: 0,
      };
    }

    const resumenPremios = await this.prisma.premios_otorgados.groupBy({
      by: ['tipo'],
      where: { id_gestion: idGestion, fuente: 'FINAL' },
      _count: { tipo: true },
    });

    const countClasificando = await this.prisma.inscripciones.count({
      where: {
        id_gestion: idGestion,
        estado_inscripcion: estado_inscripcion.FINALISTA,
        puntaje_clasificacion: { not: null },
      },
    });

    return {
      anio: gestionActiva.anio,
      clasificando: countClasificando,
      medallasOro:
        resumenPremios.find((r) => r.tipo === 'ORO')?._count.tipo ?? 0,
      medallasPlata:
        resumenPremios.find((r) => r.tipo === 'PLATA')?._count.tipo ?? 0,
      medallasBronce:
        resumenPremios.find((r) => r.tipo === 'BRONCE')?._count.tipo ?? 0,
      mencion:
        resumenPremios.find((r) => r.tipo === 'MENCION')?._count.tipo ?? 0,
    };
  }

  async getAniosHistorico(): Promise<number[]> {
    const anios = await this.prisma.gestiones.findMany({
      where: { estado: 'CERRADA' },
      select: { anio: true },
      distinct: ['anio'],
      orderBy: { anio: 'desc' },
    });
    return anios.map((a) => a.anio);
  }
}
