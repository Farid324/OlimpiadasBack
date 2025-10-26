// src/reportes/clasificados.controller.ts
import { Controller, Get, Query, Res } from '@nestjs/common';
import { ClasificadosService } from './clasificados.service';
import type { Response } from 'express';


type EstadoFiltro =
  | 'CLASIFICADO'
  | 'NO_CLASIFICADO'
  | 'DESCALIFICADO'
  | 'TODOS'
  | undefined;

@Controller('reportes/clasificados')
export class ClasificadosController {
  constructor(private readonly service: ClasificadosService) {}

  @Get()
  async list(
    @Query('id_area') id_area?: string,
    @Query('id_nivel') id_nivel?: string,
    @Query('estado') estado?: EstadoFiltro,
  ) {
    return this.service.list({
      id_area: id_area ? Number(id_area) : undefined,
      id_nivel: id_nivel ? Number(id_nivel) : undefined,
      estado: estado && estado !== 'TODOS' ? estado : undefined,
    });
  }

  @Get('resumen')
  async resumen(
    @Query('id_area') id_area?: string,
    @Query('id_nivel') id_nivel?: string,
    @Query('estado') estado?: EstadoFiltro,
  ) {
    return this.service.resumen({
      id_area: id_area ? Number(id_area) : undefined,
      id_nivel: id_nivel ? Number(id_nivel) : undefined,
      estado: estado && estado !== 'TODOS' ? estado : undefined,
    });
  }

  /** ⬇️ Descargar Excel con lo filtrado */
  @Get('export')
  async export(
    @Res() res: Response,
    @Query('id_area') id_area?: string,
    @Query('id_nivel') id_nivel?: string,
    @Query('estado') estado?: EstadoFiltro,
  ) {
    const buffer = await this.service.exportarExcel({
      id_area: id_area ? Number(id_area) : undefined,
      id_nivel: id_nivel ? Number(id_nivel) : undefined,
      estado: estado && estado !== 'TODOS' ? estado : undefined,
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="clasificados.xlsx"');
    res.send(buffer);
  }
}
