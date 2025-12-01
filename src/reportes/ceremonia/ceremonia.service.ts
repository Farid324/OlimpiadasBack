import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryCeremoniaDto } from './dto/query-ceremonia.dto';
import type { tipo_premio } from '@prisma/client';
import type { CeremoniaRow } from './excel/ceremonia.excel';

const NIVEL_ORDER: Record<string, number> = { Secundaria: 0, Primaria: 1 };
const PREMIO_ORDER: Record<tipo_premio, number> = {
  ORO: 0,
  PLATA: 1,
  BRONCE: 2,
  MENCION: 3,
};

const cmpStr = (a: string, b: string) =>
  a.localeCompare(b, 'es', { sensitivity: 'base' });

@Injectable()
export class CeremoniaService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeYear(anio?: number) {
    return anio ?? new Date().getFullYear();
  }

  /**
   * Filas usadas tanto para JSON como para Excel
   */
  async findRows(query: QueryCeremoniaDto): Promise<CeremoniaRow[]> {
    const year = this.normalizeYear(query.anio);

    const premios = await this.prisma.premios_otorgados.findMany({
      where: {
        anio: year,
        ...(query.id_area ? { id_area: query.id_area } : {}),
        ...(query.id_nivel ? { id_nivel: query.id_nivel } : {}),
      },
      include: {
        area: true,
        nivel: true,
        inscripcion: {
          include: {
            competidor: true, // aquí vienen escuela y departamento
            area: true,
            nivel: true,
          },
        },
      },
    });

    // ✅ CORRECCIÓN AQUÍ: 'anio' tipado seguro
    let rows: CeremoniaRow[] = premios.map((p) => ({
      area: p.area?.nombre_area ?? p.inscripcion?.area?.nombre_area ?? '',
      nivel: p.nivel?.nombre_nivel ?? p.inscripcion?.nivel?.nombre_nivel ?? '',
      anio: p.anio ?? year, // Si es null, usa el año de la query
      premio: String(p.tipo),
      ci: p.inscripcion?.competidor?.ci ?? null,
      competidor: `${p.inscripcion?.competidor?.nombres ?? ''} ${
        p.inscripcion?.competidor?.apellidos ?? ''
      }`.trim(),
      departamento: p.inscripcion?.competidor?.departamento ?? '',
      unidadEducativa: p.inscripcion?.competidor?.escuela ?? '',
    }));

    // Filtro de búsqueda por nombre o CI
    if (query.q) {
      const q = query.q.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.competidor.toLowerCase().includes(q) ||
          (r.ci ?? '').toLowerCase().includes(q),
      );
    }

    // Orden: área → nivel → premio → nombre
    rows.sort((a, b) => {
      const areaCmp = cmpStr(a.area || '', b.area || '');
      if (areaCmp !== 0) return areaCmp;

      const na = NIVEL_ORDER[a.nivel] ?? 99;
      const nb = NIVEL_ORDER[b.nivel] ?? 99;
      if (na !== nb) return na - nb;

      const pa = PREMIO_ORDER[a.premio as tipo_premio];
      const pb = PREMIO_ORDER[b.premio as tipo_premio];
      if (pa !== pb) return pa - pb;

      return cmpStr(a.competidor || '', b.competidor || '');
    });

    return rows;
  }

  /**
   * Resumen para cards y modal.
   */
  async resumen(query: QueryCeremoniaDto) {
    const rows = await this.findRows(query);

    const byPremio: Record<string, number> = {
      ORO: 0,
      PLATA: 0,
      BRONCE: 0,
      MENCION: 0,
    };

    for (const r of rows) {
      byPremio[r.premio] = (byPremio[r.premio] ?? 0) + 1;
    }

    const total = rows.length;
    const oro = byPremio.ORO || 0;
    const plata = byPremio.PLATA || 0;
    const bronce = byPremio.BRONCE || 0;
    const mencion = byPremio.MENCION || 0;

    return {
      // formato nuevo
      total,
      oro,
      plata,
      bronce,
      mencion,

      // formato viejo
      totales: total,
      oros: oro,
      platas: plata,
      bronces: bronce,
      menciones: mencion,
    };
  }
}
