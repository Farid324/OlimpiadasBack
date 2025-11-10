// src/reportes/publicacion/excel/publicacion.excel.ts
import ExcelJS from 'exceljs';

// CAMBIO 1: Define las columnas que quieres
export type PublicacionRow = {
  name: string;
  ci: string;
  area: string;
  school: string;
  city: string;
  year: number;
  score: number;
  medal: string;
};

// CAMBIO 2: Renombra la función
export async function buildPublicacionExcel(
  rows: PublicacionRow[],
  title = 'Reporte de Publicación', // CAMBIO 3: Nuevo título
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Publicacion');

  // CAMBIO 4: Ajusta el merge de celdas (A-I son 9 columnas)
  ws.mergeCells('A1', 'I1');
  ws.getCell('A1').value = 'Olimpiadas — Sistema de Reportes';
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };

  ws.mergeCells('A2', 'I2');
  ws.getCell('A2').value = title;
  ws.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' };

  ws.addRow([]);

  // CAMBIO 5: Define las nuevas cabeceras
  const header = [
    '#',
    'Nombre',
    'CI',
    'Área',
    'Colegio',
    'Ciudad',
    'Año',
    'Puntaje',
    'Medalla',
  ];
  const hr = ws.addRow(header);
  hr.font = { bold: true };
  hr.alignment = { horizontal: 'center' };

  // CAMBIO 6: Mapea los datos a las nuevas columnas
  rows.forEach((r, i) => {
    ws.addRow([
      i + 1,
      r.name,
      r.ci,
      r.area,
      r.school,
      r.city,
      r.year,
      r.score,
      r.medal,
    ]);
  });

  // CAMBIO 7: Define los nuevos anchos de columna
  const widths = [6, 30, 15, 20, 30, 20, 8, 10, 15];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  // La lógica de bordes es genérica y puede quedarse igual
  ws.eachRow((row, idx) => {
    if (idx >= 4) {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      });
    }
  });

  const ab = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(ab) ? ab : Buffer.from(ab as ArrayBuffer);
}
