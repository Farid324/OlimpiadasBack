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
  ci: string | null;                 // ← CI correcto desde competidores.ci
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

  /** Lista con joins y posiciones calculadas por área+nivel */
  async list(f: Filtros) {
    const where = this.buildWhere(f);

    const items = await this.prisma.inscripciones.findMany({
      where,
      include: {
        competidor: true,   // ← necesitamos competidor.ci
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

        // ⚠️ CI correcto: del competidor según tu schema.prisma
        const ci = (it.competidor?.ci ?? null) as string | null;

        salida.push({
          id_inscripcion: it.id_inscripcion,
          posicion,
          ci, // ← ahora sí el CI correcto
          nombreCompleto: `${it.competidor.nombres} ${it.competidor.apellidos}`.trim(),
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

  /** Resumen para cards */
  async resumen(f: Filtros) {
    const base = this.buildWhere({ id_area: f.id_area, id_nivel: f.id_nivel });

    const clasificados = await this.prisma.inscripciones.count({
      where: { ...base, clasificacion: { equals: 'CLASIFICADO' } },
    });

    return {
      clasificados,
      oro: 0, plata: 0, bronce: 0, menciones: 0, totalPremiados: 0,
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

/** 📦 Generar Excel con CI + cabecera institucional en TABLA (ExcelJS) */
async exportarExcel(f: Filtros): Promise<Buffer> {
  const rows = await this.list(f);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Clasificados');

  // --- Cabecera institucional (2 filas) ---
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  const fecha = `${dd}/${mm}/${yyyy}`;

  const titulo = 'Sistema de Registro y Evaluaciones Oh SanSi – 2025';
  const estadoTexto = !f.estado
    ? 'CLASIFICADOS / NO CLASIFICADOS / DESCALIFICADOS'
    : f.estado === 'CLASIFICADO'    ? 'CLASIFICADOS'
    : f.estado === 'NO_CLASIFICADO' ? 'NO CLASIFICADOS'
    : 'DESCALIFICADOS';
  const subtitulo = `LISTA DE OLIMPISTAS ${estadoTexto} – ${fecha}`;

  // 1) Título y subtítulo
  ws.addRow([titulo]);     // row 1
  ws.addRow([subtitulo]);  // row 2

  // Columnas visibles de la TABLA (no usamos headers aquí)
  const tableColumns = [
    { key: 'posicion',        width: 10 },
    { key: 'ci',              width: 18 },
    { key: 'nombreCompleto',  width: 36 },
    { key: 'area',            width: 18 },
    { key: 'nivel',           width: 14 },
    { key: 'puntaje',         width: 12 },
    { key: 'unidadEducativa', width: 32 },
    { key: 'departamento',    width: 18 },
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

  // Merge del título y subtítulo a lo ancho de la tabla
  const totalCols = tableColumns.length; // 8
  const colLetter = (n: number) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const lastColLetter = colLetter(totalCols);
  ws.mergeCells(`A1:${lastColLetter}1`);
  ws.mergeCells(`A2:${lastColLetter}2`);
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A2').font = { bold: true, size: 12 };
  ws.getCell('A1').alignment = { horizontal: 'center' };
  ws.getCell('A2').alignment = { horizontal: 'center' };

  // Espacio entre cabecera y tabla
  ws.addRow([]); // row 3

  // Definir anchos de columna
  ws.columns = tableColumns as any;

  // === TABLA ESTRUCTURADA (con filtros, franjas y estilo azul) ===
  const startRow = (ws.lastRow?.number ?? 3) + 1; // fila donde colocaremos la tabla (encabezados incluidos)
  const tableRows = rows.map(r => [
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
      // estilos "Medium" en Excel suelen ser azules; 9 y 2 son buenas opciones
      theme: 'TableStyleMedium9',
      showRowStripes: true,
      showFirstColumn: false,
      showLastColumn: false,
    },
    columns: headerLabels.map((name) => ({ name, filterButton: true })),
    rows: tableRows,
  });

  // Formato numérico SOLO para la columna Puntuación dentro de la tabla
  const puntajeColIdx = 6; // A=1, B=2, ..., F=6 (Puntuación)
  const firstDataRow = startRow + 1;                 // fila de datos (debajo del header de tabla)
  const lastDataRow  = firstDataRow + tableRows.length - 1;
  for (let i = firstDataRow; i <= lastDataRow; i++) {
    ws.getRow(i).getCell(puntajeColIdx).numFmt = '0.00';
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer);
}


}
