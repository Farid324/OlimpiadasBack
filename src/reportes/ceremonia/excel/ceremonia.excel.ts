// src/reportes/ceremonia/excel/ceremonia.excel.ts
import ExcelJS from 'exceljs';

export type CeremoniaRow = {
  area: string;
  nivel: string;
  anio: number;
  premio: string;            // ORO | PLATA | BRONCE | MENCION
  ci: string | null;         // (no se usa en el Excel, pero lo mantenemos por compatibilidad)
  competidor: string;
  departamento?: string;     // NUEVO
  unidadEducativa?: string;  // NUEVO
};

export async function buildCeremoniaExcel(
  rows: CeremoniaRow[],
  title = 'Ceremonia de Premiación',
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Ceremonia');

  // ───────── Encabezado institucional (2 filas) ─────────
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  const fecha = `${dd}/${mm}/${yyyy}`;

  const titulo = 'Sistema de Registro y Evaluaciones Oh SanSi – 2025';
  const subtitulo = `LISTA DE PREMIADOS – ${fecha}`;

  // Las columnas de la tabla (7 columns)
  const headers = [
    '#',
    'Área',
    'Nivel',
    'Premio',
    'Competidor',
    'Departamento',
    'Unidad Educativa',
  ] as const;

  const totalCols = headers.length;
  const colLetter = (n: number) => {
    let s = '';
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };
  const last = colLetter(totalCols);

  ws.addRow([titulo]);   // A1
  ws.addRow([subtitulo]); // A2
  ws.mergeCells(`A1:${last}1`);
  ws.mergeCells(`A2:${last}2`);

  const c1 = ws.getCell('A1');
  c1.font = { bold: true, size: 14 };
  c1.alignment = { horizontal: 'center' };

  const c2 = ws.getCell('A2');
  c2.font = { bold: true, size: 12 };
  c2.alignment = { horizontal: 'center' };

  ws.addRow([]); // espacio -> row 3

  // ───────── Anchos sugeridos ─────────
  ws.columns = [
    { key: 'num', width: 6 },
    { key: 'area', width: 22 },
    { key: 'nivel', width: 14 },
    { key: 'premio', width: 14 },
    { key: 'competidor', width: 36 },
    { key: 'departamento', width: 18 },
    { key: 'unidadEducativa', width: 30 },
  ] as any;

  // ───────── Datos para la tabla estructurada ─────────
  const startRow = (ws.lastRow?.number ?? 3) + 1;
  const tableRows = rows.map((r, i) => [
    i + 1,
    r.area ?? '',
    r.nivel ?? '',
    r.premio ?? '',
    r.competidor ?? '',
    r.departamento ?? '',
    r.unidadEducativa ?? '',
  ]);

  ws.addTable({
    name: 'TablaCeremonia',
    ref: `A${startRow}`,
    headerRow: true,
    totalsRow: false,
    style: {
      theme: 'TableStyleMedium9',
      showRowStripes: true,
    },
    columns: headers.map((h) => ({ name: h, filterButton: true })),
    rows: tableRows,
  });

  // Bordes sutiles para toda el área de datos (opcional)
  const firstDataRow = startRow + 1;
  const lastDataRow = firstDataRow + tableRows.length - 1;
  for (let r = startRow; r <= lastDataRow; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= totalCols; c++) {
      const cell = row.getCell(c);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
      if (r === startRow) {
        // header
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center' };
      }
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer);
}