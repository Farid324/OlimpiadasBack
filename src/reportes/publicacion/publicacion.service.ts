// src/reportes/publicacion/publicacion.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryPublicacionDto } from './dto/query-publicacion.dto';

// Tipo para las filas de publicación (mantiene columnas originales)
export type PublicacionRow = {
  name: string;
  ci: string;
  area: string;
  nivel: string;
  school: string;
  city: string;
  year: number;
  score: number;
  medal: string;
};

type EstadoMedalla = 'ORO' | 'PLATA' | 'BRONCE' | 'MENCION';

// Helper para ordenar strings
const cmpStr = (a: string, b: string) =>
  a.localeCompare(b, 'es', { sensitivity: 'base' });

@Injectable()
export class PublicacionService {
  private readonly logger = new Logger(PublicacionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Determina la medalla según la posición (copiado de premiados.service.ts)
   */
  private medallaDePosicion(
    pos: number,
    cfg: { oro: number; plata: number; bronce: number; menciones: number },
  ): { tipo: EstadoMedalla | null; etiqueta: string } {
    if (pos <= cfg.oro) return { tipo: 'ORO', etiqueta: 'Medalla de Oro' };
    if (pos <= cfg.oro + cfg.plata)
      return { tipo: 'PLATA', etiqueta: 'Medalla de Plata' };
    if (pos <= cfg.oro + cfg.plata + cfg.bronce)
      return { tipo: 'BRONCE', etiqueta: 'Medalla de Bronce' };
    if (pos <= cfg.oro + cfg.plata + cfg.bronce + cfg.menciones)
      return { tipo: 'MENCION', etiqueta: 'Mención Honorífica' };
    return { tipo: null, etiqueta: 'Sin Medalla' };
  }

  /**
   * Construye la lista para un par área+nivel específico
   */
  private async buildListForPair(
    id_area: number,
    id_nivel: number,
    id_gestion: number,
    anioGestion: number,
  ): Promise<PublicacionRow[]> {
    // 1) Nota mínima de aprobación (configuración de área)
    const areaCfg = await this.prisma.areas.findUnique({
      where: { id_area },
      select: {
        nota_aprobacion: true,
        nota_aprobacion_final: true,
      },
    });

    const minScore =
      areaCfg?.nota_aprobacion_final ?? areaCfg?.nota_aprobacion ?? 51;

    // 2) Medallero del área/nivel/gestión
    const medallero = await this.prisma.medallero_config.findFirst({
      where: {
        id_area,
        id_nivel,
        id_gestion,
      },
      orderBy: { id_medallero: 'desc' },
    });

    const cfg = {
      oro: medallero?.oros ?? 0,
      plata: medallero?.platas ?? 0,
      bronce: medallero?.bronces ?? 0,
      menciones: medallero?.menciones ?? 0,
    };

    this.logger.debug(
      `📊 Área ${id_area}, Nivel ${id_nivel}: Medallero O=${cfg.oro}, P=${cfg.plata}, B=${cfg.bronce}, M=${cfg.menciones}`,
    );

    // 3) Inscripciones del área/nivel/gestión
    const inscripciones = await this.prisma.inscripciones.findMany({
      where: {
        id_area,
        id_nivel,
        id_gestion,
      },
      include: {
        competidor: true,
        area: true,
        nivel: true,
      },
    });

    if (inscripciones.length === 0) return [];

    // 4) Obtener fase FINAL para promedios
    const faseFinal = await this.prisma.fases.findFirst({
      where: { nombre_fase: 'FINAL' },
      select: { id_fase: true },
    });

    const id_fase_final = faseFinal?.id_fase;

    // 5) Sacar promedio de evaluaciones finales firmadas
    const scoreMap = new Map<number, number>();

    if (id_fase_final) {
      const ids = inscripciones.map((i) => i.id_inscripcion);
      const evals = await this.prisma.evaluaciones.groupBy({
        by: ['id_inscripcion'],
        where: {
          id_inscripcion: { in: ids },
          id_fase: id_fase_final,
          estado_registro: 'FIRMADA',
        },
        _avg: {
          nota: true,
        },
      });

      for (const e of evals) {
        scoreMap.set(e.id_inscripcion, Number(e._avg.nota ?? 0));
      }
    }

    // 6) Ordenar inscripciones por puntaje
    const ordenados = [...inscripciones]
      .map((insc) => {
        const dbScore = insc.puntaje_final ? Number(insc.puntaje_final) : null;
        const calcScore = scoreMap.get(insc.id_inscripcion) ?? null;
        const score = dbScore ?? calcScore;

        return {
          inscripcion: insc,
          score,
        };
      })
      .filter((x) => typeof x.score === 'number' && !Number.isNaN(x.score))
      .sort(
        (a, b) =>
          (b.score as number) - (a.score as number) ||
          a.inscripcion.id_inscripcion - b.inscripcion.id_inscripcion,
      );

    if (ordenados.length === 0) return [];

    // 7) Asignar medallas SOLO a quienes cumplen la nota mínima
    const salida: PublicacionRow[] = [];
    let pos = 0;

    for (const item of ordenados) {
      const { inscripcion, score } = item;
      const numericScore = Number(score);

      if (Number.isNaN(numericScore)) continue;

      // Filtrar por nota mínima de aprobación
      if (numericScore < minScore) {
        continue;
      }

      // La posición solo cuenta entre los que cumplen la nota mínima
      pos += 1;

      const med = this.medallaDePosicion(pos, cfg);

      salida.push({
        name: `${inscripcion.competidor?.nombres ?? ''} ${inscripcion.competidor?.apellidos ?? ''}`.trim(),
        ci: inscripcion.competidor?.ci ?? '',
        area: inscripcion.area?.nombre_area ?? '',
        nivel: inscripcion.nivel?.nombre_nivel ?? '',
        school: inscripcion.competidor?.escuela ?? '',
        city: inscripcion.competidor?.departamento ?? '',
        year: anioGestion,
        score: numericScore,
        medal: med.etiqueta,
      });
    }

    return salida;
  }

  async findRows(query: QueryPublicacionDto): Promise<PublicacionRow[]> {
    // 1. Obtener la gestión abierta
    let gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' },
      orderBy: { created_at: 'desc' },
    });

    // Si no hay gestión abierta, buscar la última cerrada
    if (!gestion) {
      gestion = await this.prisma.gestiones.findFirst({
        where: { estado: 'CERRADA' },
        orderBy: { created_at: 'desc' },
      });
    }

    if (!gestion) {
      this.logger.warn('No hay gestión disponible');
      return [];
    }

    const idGestion = gestion.id_gestion;
    const anioGestion = gestion.anio || new Date().getFullYear();

    this.logger.log(`📊 Usando gestión ID=${idGestion}, Año=${anioGestion}`);

    // 2. Si se especifican área y nivel, solo procesar ese par
    if (
      query.id_area &&
      query.id_area > 0 &&
      query.id_nivel &&
      query.id_nivel > 0
    ) {
      const rows = await this.buildListForPair(
        query.id_area,
        query.id_nivel,
        idGestion,
        anioGestion,
      );

      this.logger.log(`✅ Total filas generadas: ${rows.length}`);
      return rows;
    }

    // 3. Si no, obtener todos los pares área/nivel con inscripciones
    const pares = await this.prisma.inscripciones.findMany({
      where: {
        id_gestion: idGestion,
        ...(query.id_area && query.id_area > 0
          ? { id_area: query.id_area }
          : {}),
        ...(query.id_nivel && query.id_nivel > 0
          ? { id_nivel: query.id_nivel }
          : {}),
      },
      select: {
        id_area: true,
        id_nivel: true,
      },
      distinct: ['id_area', 'id_nivel'],
    });

    this.logger.log(`📁 Pares área/nivel encontrados: ${pares.length}`);

    // 4. Construir lista para cada par
    const allRows: PublicacionRow[] = [];

    for (const par of pares) {
      const parcial = await this.buildListForPair(
        par.id_area,
        par.id_nivel,
        idGestion,
        anioGestion,
      );
      allRows.push(...parcial);
    }

    // 5. Ordenar resultado final por área, nivel y puntaje
    allRows.sort((a, b) => {
      const areaComp = cmpStr(a.area, b.area);
      if (areaComp !== 0) return areaComp;

      const nivelComp = cmpStr(a.nivel, b.nivel);
      if (nivelComp !== 0) return nivelComp;

      return b.score - a.score;
    });

    // Log resumen de medallas
    const resumen = {
      oro: allRows.filter((r) => r.medal === 'Medalla de Oro').length,
      plata: allRows.filter((r) => r.medal === 'Medalla de Plata').length,
      bronce: allRows.filter((r) => r.medal === 'Medalla de Bronce').length,
      mencion: allRows.filter((r) => r.medal === 'Mención Honorífica').length,
      sinMedalla: allRows.filter((r) => r.medal === 'Sin Medalla').length,
    };

    this.logger.log(
      `📊 RESUMEN: Oro=${resumen.oro}, Plata=${resumen.plata}, Bronce=${resumen.bronce}, Mención=${resumen.mencion}, Sin Medalla=${resumen.sinMedalla}`,
    );
    this.logger.log(`✅ Total filas generadas: ${allRows.length}`);

    return allRows;
  }
}
