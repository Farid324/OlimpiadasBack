// src/reportes/publicacion/excel/publicacion.excel.ts
import * as ExcelJS from 'exceljs';

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

/**
 * Genera el Excel de publicación con el mismo diseño que premiados
 * pero manteniendo las columnas originales de publicación
 */
export async function generatePublicacionExcel(
  rows: PublicacionRow[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Publicación');

  const now = new Date();
  const fecha = now.toLocaleDateString('es-BO');

  const titulo = 'Sistema de Registro y Evaluaciones Oh SanSi – Publicación';
  const subtitulo = `LISTA DE RESULTADOS – ${fecha}`;

  // Columnas de publicación (originales)
  const headers = [
    'Nombre Completo',
    'CI',
    'Área',
    'Nivel',
    'Unidad Educativa',
    'Departamento',
    'Año',
    'Puntuación',
    'Medalla',
  ];

  // Título y subtítulo
  ws.addRow([titulo]);
  ws.addRow([subtitulo]);

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
  const lastCol = colLetter(totalCols);

  // Merge y estilo de títulos
  ws.mergeCells(`A1:${lastCol}1`);
  ws.mergeCells(`A2:${lastCol}2`);
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A2').font = { bold: true, size: 12 };
  ws.getCell('A1').alignment = { horizontal: 'center' };
  ws.getCell('A2').alignment = { horizontal: 'center' };

  // Fila vacía
  ws.addRow([]);

  const startRow = ws.lastRow!.number + 1;

  // Crear tabla con filtros (igual que premiados)
  ws.addTable({
    name: 'TablaPublicacion',
    ref: `A${startRow}`,
    headerRow: true,
    style: {
      theme: 'TableStyleMedium9',
      showRowStripes: true,
    },
    columns: headers.map((name) => ({ name, filterButton: true })),
    rows: rows.map((r) => [
      r.name,
      r.ci,
      r.area,
      r.nivel,
      r.school,
      r.city,
      r.year,
      typeof r.score === 'number' ? r.score.toFixed(2) : '',
      r.medal,
    ]),
  });

  // Anchos de columnas
  ws.getColumn(1).width = 32; // Nombre Completo
  ws.getColumn(2).width = 14; // CI
  ws.getColumn(3).width = 18; // Área
  ws.getColumn(4).width = 14; // Nivel
  ws.getColumn(5).width = 30; // Unidad Educativa
  ws.getColumn(6).width = 16; // Departamento
  ws.getColumn(7).width = 8; // Año
  ws.getColumn(8).width = 12; // Puntuación
  ws.getColumn(9).width = 20; // Medalla

  // Aplicar colores a las celdas de medalla
  const dataStartRow = startRow + 1; // +1 por el header de la tabla
  const medalColIndex = 9; // Columna I (Medalla)

  for (let i = 0; i < rows.length; i++) {
    const rowNum = dataStartRow + i;
    const cell = ws.getCell(rowNum, medalColIndex);
    const medal = rows[i].medal;

    // Colores según el tipo de medalla
    if (medal === 'Medalla de Oro') {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFD700' }, // Dorado
      };
      cell.font = { bold: true, color: { argb: 'FF8B4513' } };
    } else if (medal === 'Medalla de Plata') {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFC0C0C0' }, // Plateado
      };
      cell.font = { bold: true, color: { argb: 'FF2F4F4F' } };
    } else if (medal === 'Medalla de Bronce') {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFCD7F32' }, // Bronce
      };
      cell.font = { bold: true, color: { argb: 'FF3E2723' } };
    } else if (medal === 'Mención Honorífica') {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF98D8C8' }, // Verde agua
      };
      cell.font = { bold: true, color: { argb: 'FF1B5E20' } };
    }
    // Sin Medalla queda sin color especial
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer);
}
