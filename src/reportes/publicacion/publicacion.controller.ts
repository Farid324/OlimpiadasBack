// src/reportes/publicacion/publicacion.controller.ts
import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { PublicacionService } from './publicacion.service';
import { QueryPublicacionDto } from './dto/query-publicacion.dto';
import { generatePublicacionExcel } from './excel/publicacion.excel';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ADMIN, RESPONSABLE } from '../../auth/constants';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ADMIN, RESPONSABLE)
@Controller('reportes/publicacion')
export class PublicacionController {
  constructor(private readonly service: PublicacionService) {}

  /** Lista de filas para mostrar en la tabla del frontend */
  @Get()
  async list(@Query() query: QueryPublicacionDto) {
    return this.service.findRows(query);
  }

  /** Exportar Excel - EXACTAMENTE igual que premiados.controller.ts */
  @Get('export')
  async export(
    @Res() res: Response,
    @Query('id_area') id_area?: string,
    @Query('id_nivel') id_nivel?: string,
  ) {
    const area = id_area ? Number(id_area) : undefined;
    const nivel = id_nivel ? Number(id_nivel) : undefined;

    const data = await this.service.findRows({
      id_area: area,
      id_nivel: nivel,
    });

    const buffer = await generatePublicacionExcel(data);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="lista-publicacion.xlsx"',
    );
    res.send(buffer);
  }
}
