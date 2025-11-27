//src/reportes/premiados.controller.ts
import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { PremiadosService } from './premiados.service';
import { FasesService } from '../fases/fases.service';
import { PhaseType } from '../fases/dto/close-phase.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ADMIN, RESPONSABLE } from '../auth/constants';
import * as ExcelJS from 'exceljs';

type EstadoMedalla = 'ORO' | 'PLATA' | 'BRONCE' | 'MENCION' | 'TODOS';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ADMIN, RESPONSABLE)
@Controller('reportes/premiados')
export class PremiadosController {
  constructor(
    private readonly service: PremiadosService,
    private readonly fases: FasesService,
  ) {}

  @Get()
  async list(
    @Query('id_area') id_area?: string,
    @Query('id_nivel') id_nivel?: string,
    @Query('estado') estado?: EstadoMedalla,
  ) {
    const area = id_area ? Number(id_area) : undefined;
    const nivel = id_nivel ? Number(id_nivel) : undefined;

    if (area && nivel) {
      const st = await this.fases.getStatus(area, nivel, PhaseType.FINAL);
      if (st !== 'VALIDADA') {
        throw new HttpException(
          'No es posible publicar los resultados: la fase no ha sido avalada.',
          HttpStatus.LOCKED,
        );
      }
    }

    return this.service.list({
      id_area: area,
      id_nivel: nivel,
      estado: estado && estado !== 'TODOS' ? estado : undefined,
    });
  }

  @Get('resumen')
  async resumen(
    @Query('id_area') id_area?: string,
    @Query('id_nivel') id_nivel?: string,
  ) {
    const area = id_area ? Number(id_area) : undefined;
    const nivel = id_nivel ? Number(id_nivel) : undefined;

    if (area && nivel) {
      const st = await this.fases.getStatus(area, nivel, PhaseType.FINAL);
      if (st !== 'VALIDADA') {
        throw new HttpException(
          'No es posible publicar los resultados: la fase no ha sido avalada.',
          HttpStatus.LOCKED,
        );
      }
    }

    return this.service.resumen({ id_area: area, id_nivel: nivel });
  }

  /** ⬇️ Exportar Excel con los mismos filtros que la tabla */
  @Get('export')
  async export(
    @Res() res: Response,
    @Query('id_area') id_area?: string,
    @Query('id_nivel') id_nivel?: string,
    @Query('estado') estado?: EstadoMedalla,
  ) {
    const area = id_area ? Number(id_area) : undefined;
    const nivel = id_nivel ? Number(id_nivel) : undefined;

    if (area && nivel) {
      const st = await this.fases.getStatus(area, nivel, PhaseType.FINAL);
      if (st !== 'VALIDADA') {
        throw new HttpException(
          'No es posible exportar la lista: la fase no ha sido avalada.',
          HttpStatus.LOCKED,
        );
      }
    }

    const data = await this.service.list({
      id_area: area,
      id_nivel: nivel,
      estado: estado && estado !== 'TODOS' ? estado : undefined,
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Premiados');

    const now = new Date();
    const fecha = now.toLocaleDateString('es-BO');

    const titulo = 'Sistema de Registro y Evaluaciones Oh SanSi – Premiados';
    const subtitulo = `LISTA DE PREMIADOS – ${fecha}`;

    const headers = [
      'Posición',
      'Nombre completo',
      'Premio',
      'Área',
      'Nivel',
      'Puntuación',
      'Unidad Educativa',
      'Departamento',
    ];

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

    ws.mergeCells(`A1:${lastCol}1`);
    ws.mergeCells(`A2:${lastCol}2`);
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.getCell('A2').font = { bold: true, size: 12 };
    ws.getCell('A1').alignment = { horizontal: 'center' };
    ws.getCell('A2').alignment = { horizontal: 'center' };

    ws.addRow([]);

    const startRow = ws.lastRow!.number + 1;

    ws.addTable({
      name: 'TablaPremiados',
      ref: `A${startRow}`,
      headerRow: true,
      style: {
        theme: 'TableStyleMedium9',
        showRowStripes: true,
      },
      columns: headers.map((name) => ({ name, filterButton: true })),
      rows: data.map((r) => [
        r.posicion ?? '',
        r.nombreCompleto,
        r.premio,
        r.area,
        r.nivel,
        r.puntuacion,
        r.unidadEducativa,
        r.departamento,
      ]),
    });

    ws.getColumn(1).width = 10;
    ws.getColumn(2).width = 32;
    ws.getColumn(3).width = 20;
    ws.getColumn(4).width = 18;
    ws.getColumn(5).width = 14;
    ws.getColumn(6).width = 12;
    ws.getColumn(7).width = 30;
    ws.getColumn(8).width = 16;

    const buf = await wb.xlsx.writeBuffer();
    const buffer = Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="lista-premiados.xlsx"',
    );
    res.send(buffer);
  }
}
