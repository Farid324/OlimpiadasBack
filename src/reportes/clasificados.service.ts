// src/reportes/clasificados.service.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';

type Estado = 'CLASIFICADO' | 'NO_CLASIFICADO' | 'DESCALIFICADO';
type Filtros = { id_area?: number; id_nivel?: number; estado?: Estado };

type Row = {
  id_inscripcion: number;
  posicion: number | null;
  ci: string | null;
  nombreCompleto: string;
  area: string;
  nivel: string;
  puntaje: number;
  unidadEducativa: string;
  departamento: string;
};

@Injectable()
export class ClasificadosService {
  constructor(private prisma: PrismaService) {}

  private buildWhere(f: Filtros): Prisma.inscripcionesWhereInput {
    const where: Prisma.inscripcionesWhereInput = {};
    if (f.id_area) where.id_area = f.id_area;
    if (f.id_nivel) where.id_nivel = f.id_nivel;
    if (f.estado) where.clasificacion = { equals: f.estado };
    return where;
  }

  /** Lista con joins y posiciones calculadas por área+nivel (solo gestión ABIERTA) */
  async list(f: Filtros) {
    // 🔹 Gestion ABIERTA obligatoria
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' },
      select: { id_gestion: true },
    });

    if (!gestion) {
      return [];
    }

    const where: Prisma.inscripcionesWhereInput = {
      ...this.buildWhere(f),
      id_gestion: gestion.id_gestion, // 🔹 Solo gestión actual
    };

    const items = await this.prisma.inscripciones.findMany({
      where,
      include: {
        competidor: true,
        area: true,
        nivel: true,
      },
      orderBy: [
        { id_area: 'asc' },
        { id_nivel: 'asc' },
        { puntaje_clasificacion: 'desc' },
        { id_inscripcion: 'asc' },
      ],
    });

    type Item = (typeof items)[number];
    const groups = new Map<string, Item[]>();

    for (const it of items) {
      const k = `${it.id_area}|${it.id_nivel}`;
      const arr = groups.get(k);
      if (arr) arr.push(it);
      else groups.set(k, [it]);
    }

    const salida: Row[] = [];

    for (const [, grupo] of groups) {
      let pos = 0;
      for (const it of grupo) {
        const esClasificado = it.clasificacion === 'CLASIFICADO';
        const posicion = esClasificado ? ++pos : null;

        const ci = (it.competidor?.ci ?? null) as string | null;

        salida.push({
          id_inscripcion: it.id_inscripcion,
          posicion,
          ci,
          nombreCompleto:
            `${it.competidor.nombres} ${it.competidor.apellidos}`.trim(),
          area: it.area.nombre_area,
          nivel: it.nivel.nombre_nivel,
          puntaje: Number(it.puntaje_clasificacion ?? 0),
          unidadEducativa: it.competidor.escuela ?? '',
          departamento: it.competidor.departamento ?? '',
        });
      }
    }

    return salida;
  }

  /** Resumen para cards (solo gestión ABIERTA) */
  async resumen(f: Filtros) {
    // 🔹 Gestion ABIERTA obligatoria
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' },
      select: { id_gestion: true },
    });

    if (!gestion) {
      return {
        clasificados: 0,
        oro: 0,
        plata: 0,
        bronce: 0,
        menciones: 0,
        totalPremiados: 0,
      };
    }

    const base = {
      ...this.buildWhere({ id_area: f.id_area, id_nivel: f.id_nivel }),
      id_gestion: gestion.id_gestion, // 🔹 Solo gestión actual
    } satisfies Prisma.inscripcionesWhereInput;

    const clasificados = await this.prisma.inscripciones.count({
      where: { ...base, clasificacion: { equals: 'CLASIFICADO' } },
    });

    return {
      clasificados,
      oro: 0,
      plata: 0,
      bronce: 0,
      menciones: 0,
      totalPremiados: 0,
    };
  }

  // ==== Helpers Excel ====
  private colLetter(n: number): string {
    let s = '';
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  private estadoTexto(estado?: Estado): string {
    if (!estado) return 'CLASIFICADOS / NO CLASIFICADOS / DESCALIFICADOS';
    if (estado === 'CLASIFICADO') return 'CLASIFICADOS';
    if (estado === 'NO_CLASIFICADO') return 'NO CLASIFICADOS';
    if (estado === 'DESCALIFICADO') return 'DESCALIFICADOS';
    return 'CLASIFICADOS / NO CLASIFICADOS / DESCALIFICADOS';
  }

  /** Exportar Excel (se apoya en list(), ya filtrado por gestión actual) */
  async exportarExcel(f: Filtros): Promise<Buffer> {
    const rows = await this.list(f);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Clasificados');

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = String(now.getFullYear());
    const fecha = `${dd}/${mm}/${yyyy}`;

    const titulo = 'Sistema de Registro y Evaluaciones Oh SanSi – 2025';
    const estadoTexto = !f.estado
      ? 'CLASIFICADOS / NO CLASIFICADOS / DESCALIFICADOS'
      : f.estado === 'CLASIFICADO'
        ? 'CLASIFICADOS'
        : f.estado === 'NO_CLASIFICADO'
          ? 'NO CLASIFICADOS'
          : 'DESCALIFICADOS';
    const subtitulo = `LISTA DE OLIMPISTAS ${estadoTexto} – ${fecha}`;

    ws.addRow([titulo]); // row 1
    ws.addRow([subtitulo]); // row 2

    const tableColumns = [
      { key: 'posicion', width: 10 },
      { key: 'ci', width: 18 },
      { key: 'nombreCompleto', width: 36 },
      { key: 'area', width: 18 },
      { key: 'nivel', width: 14 },
      { key: 'puntaje', width: 12 },
      { key: 'unidadEducativa', width: 32 },
      { key: 'departamento', width: 18 },
    ] as const;

    const headerLabels = [
      'Posición',
      'CI',
      'Nombre',
      'Área',
      'Nivel',
      'Puntuación',
      'Unidad Educativa',
      'Departamento',
    ];

    const totalCols = tableColumns.length;
    const colLetter = (n: number) => {
      let s = '';
      while (n > 0) {
        const m = (n - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        n = Math.floor((n - 1) / 26);
      }
      return s;
    };
    const lastColLetter = colLetter(totalCols);
    ws.mergeCells(`A1:${lastColLetter}1`);
    ws.mergeCells(`A2:${lastColLetter}2`);
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.getCell('A2').font = { bold: true, size: 12 };
    ws.getCell('A1').alignment = { horizontal: 'center' };
    ws.getCell('A2').alignment = { horizontal: 'center' };

    ws.addRow([]); // row 3 espacio

    ws.columns = tableColumns as any;

    const startRow = (ws.lastRow?.number ?? 3) + 1;
    const tableRows = rows.map((r) => [
      r.posicion ?? null,
      r.ci ?? '',
      r.nombreCompleto,
      r.area,
      r.nivel,
      r.puntaje,
      r.unidadEducativa,
      r.departamento,
    ]);

    ws.addTable({
      name: 'TablaClasificados',
      ref: `A${startRow}`,
      headerRow: true,
      totalsRow: false,
      style: {
        theme: 'TableStyleMedium9',
        showRowStripes: true,
        showFirstColumn: false,
        showLastColumn: false,
      },
      columns: headerLabels.map((name) => ({ name, filterButton: true })),
      rows: tableRows,
    });

    const puntajeColIdx = 6;
    const firstDataRow = startRow + 1;
    const lastDataRow = firstDataRow + tableRows.length - 1;
    for (let i = firstDataRow; i <= lastDataRow; i++) {
      ws.getRow(i).getCell(puntajeColIdx).numFmt = '0.00';
    }

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer);
  }
}
