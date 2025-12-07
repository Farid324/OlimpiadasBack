// src/reportes/ceremonia/ceremonia.service.ts
import { Injectable } from '@nestjs/common';
import { PremiadosService } from '../premiados.service';
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
  constructor(private readonly premiados: PremiadosService) {}

  private normalizeYear(anio?: number) {
    return anio ?? new Date().getFullYear();
  }

  /**
   * Ceremonia ahora usa la MISMA fuente que Premiados y Certificados.
   * No usa premios_otorgados.
   */
  async findRows(query: QueryCeremoniaDto): Promise<CeremoniaRow[]> {
    const anio = this.normalizeYear(query.anio);

    // 1️⃣ Obtener premiados igual que certificados/premiados
    const lista = await this.premiados.list({
      id_area: query.id_area,
      id_nivel: query.id_nivel,
      estado: undefined,
      actorId: undefined,
    });

    // 2️⃣ Mapear al formato de CeremoniaRow
    let rows: CeremoniaRow[] = lista.map((p) => ({
      area: p.area,
      nivel: p.nivel,
      anio,
      premio: p.estadoPremio, // ORO, PLATA, BRONCE, MENCION
      ci: null,               // opcional, no se usa en Excel
      competidor: p.nombreCompleto,
      departamento: p.departamento,
      unidadEducativa: p.unidadEducativa,
    }));

    // 3️⃣ Filtro por búsqueda
    if (query.q) {
      const q = query.q.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.competidor.toLowerCase().includes(q) ||
          (r.ci ?? '').toLowerCase().includes(q),
      );
    }

    // 4️⃣ Ordenamiento:
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
   * Resumen para cards y modal
   */
  async resumen(query: QueryCeremoniaDto) {
    const rows = await this.findRows(query);

    const summary = {
      ORO: 0,
      PLATA: 0,
      BRONCE: 0,
      MENCION: 0,
    };

    for (const r of rows) {
      summary[r.premio]++;
    }

    return {
      total: rows.length,
      oro: summary.ORO,
      plata: summary.PLATA,
      bronce: summary.BRONCE,
      mencion: summary.MENCION,

      // compatibilidad con frontend viejo
      totales: rows.length,
      oros: summary.ORO,
      platas: summary.PLATA,
      bronces: summary.BRONCE,
      menciones: summary.MENCION,
    };
  }
}
