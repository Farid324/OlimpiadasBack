// src/utils/csv.util.ts

import * as csv from 'fast-csv';
import { RegistroOlimpistaDto } from '../olimpistas/dto/registro-olimpista.dto';

export async function parseCsvToDtos(
  buf: Buffer,
): Promise<RegistroOlimpistaDto[]> {
  return new Promise((resolve, reject) => {
    const out: any[] = [];
    csv
      .parseString(buf.toString('utf8'), {
        headers: true,
        trim: true,
        ignoreEmpty: true,
      })
      .on('error', reject)
      .on('data', (row) => out.push(row))
      .on('end', () => {
        for (const r of out) {
          if (typeof r.departamento === 'string') {
            r.departamento = r.departamento.trim();
            const map: Record<string, string> = {
              'LA PAZ': 'La Paz',
              'La Paz': 'La Paz',
              LAPAZ: 'La Paz',
              'SANTA CRUZ': 'Santa Cruz',
              'Santa Cruz': 'Santa Cruz',
              SANTACRUZ: 'Santa Cruz',
              COCHABAMBA: 'Cochabamba',
              Cochabamba: 'Cochabamba',
              ORURO: 'Oruro',
              POTOSÍ: 'Potosí',
              POTOSI: 'Potosí',
              CHUQUISACA: 'Chuquisaca',
              BENI: 'Beni',
              PANDO: 'Pando',
              TARIJA: 'Tarija',
            };
            r.departamento =
              map[r.departamento.toUpperCase()] ?? r.departamento;
          }
        }
        resolve(out as RegistroOlimpistaDto[]);
      });
  });
}
