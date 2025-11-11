// src/reportes/publicacion/publicacion.controller.ts
import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PublicacionService } from './publicacion.service';
import { QueryPublicacionDto } from './dto/query-publicacion.dto';
import { buildPublicacionExcel } from './excel/publicacion.excel';

// CAMBIO 1: Nueva ruta
@Controller('reportes/publicacion')
export class PublicacionController {
  constructor(private readonly service: PublicacionService) {}

  // CAMBIO 2: Quitamos los endpoints 'resumen' y 'lista'
  // Dejamos solo 'export'

  /** Excel para el botón "Generar para Publicación" */
  @Get('export')
  async export(@Query() query: QueryPublicacionDto, @Res() res: Response) {
    // Llama al nuevo servicio
    const rows = await this.service.findRows(query);
    // Llama al nuevo generador de Excel
    const buf = await buildPublicacionExcel(rows, 'Reporte de Publicación');

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    // CAMBIO 3: Nuevo nombre de archivo
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="publicacion.xlsx"',
    );
    res.send(buf);
  }
}
