// src/reportes/ceremonia/ceremonia.controller.ts
import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';                  // 👈 type-only
import { CeremoniaService } from './ceremonia.service';
import { QueryCeremoniaDto } from './dto/query-ceremonia.dto';
import { buildCeremoniaExcel } from './excel/ceremonia.excel';

@Controller('reportes/ceremonia')
export class CeremoniaController {
  constructor(private readonly service: CeremoniaService) {}

  /** Contadores para las cards (oro, plata, bronce, menciones, total) */
  @Get('resumen')
  async getResumen(@Query() query: QueryCeremoniaDto) {
    return this.service.resumen(query);
  }

  /** Lista JSON (útil si quieres un preview) */
  @Get()
  async getLista(@Query() query: QueryCeremoniaDto) {
    return this.service.findRows(query);
  }

  /** Excel para el botón "Generar Lista de Ceremonia" */
  @Get('export')
  async export(@Query() query: QueryCeremoniaDto, @Res() res: Response) {
    const rows = await this.service.findRows(query);
    const buf = await buildCeremoniaExcel(rows, 'Ceremonia de Premiación');

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="ceremonia.xlsx"');
    res.send(buf);
  }
}
