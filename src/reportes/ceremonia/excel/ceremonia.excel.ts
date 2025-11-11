// src/reportes/ceremonia/excel/ceremonia.excel.ts
import ExcelJS from 'exceljs';

export type CeremoniaRow = {
  area: string;
  nivel: string;
  anio: number;
  premio: string;
  ci: string | null;
  competidor: string;
};

export async function buildCeremoniaExcel(
  rows: CeremoniaRow[],
  title = 'Ceremonia de Premiación',
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Ceremonia');

  ws.mergeCells('A1', 'G1');
  ws.getCell('A1').value = 'Olimpiadas — Sistema de Reportes';
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };

  ws.mergeCells('A2', 'G2');
  ws.getCell('A2').value = title;
  ws.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' };

  ws.addRow([]);

  const header = ['#', 'Área', 'Nivel', 'Año', 'Premio', 'CI', 'Competidor'];
  const hr = ws.addRow(header);
  hr.font = { bold: true };
  hr.alignment = { horizontal: 'center' };

  rows.forEach((r, i) => {
    ws.addRow([i + 1, r.area, r.nivel, r.anio, r.premio, r.ci ?? '', r.competidor]);
  });

  const widths = [6, 22, 14, 8, 14, 16, 34];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

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

  const ab = await wb.xlsx.writeBuffer(); // ArrayBuffer
  // Asegurar Buffer para Express
  return Buffer.isBuffer(ab) ? ab : Buffer.from(ab as ArrayBuffer);
}
