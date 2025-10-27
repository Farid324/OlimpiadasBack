// src/reportes/clasificados.controller.ts
import {
  Controller,
  Get,
  Query,
  Res,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ClasificadosService } from './clasificados.service';
import type { Response } from 'express';
import { FasesService } from '../fases/fases.service';
import { PhaseType } from '../fases/dto/close-phase.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ADMIN } from '../auth/constants';

type EstadoFiltro =
  | 'CLASIFICADO'
  | 'NO_CLASIFICADO'
  | 'DESCALIFICADO'
  | 'TODOS'
  | undefined;

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ADMIN)
@Controller('reportes/clasificados')
export class ClasificadosController {
  constructor(
    private readonly service: ClasificadosService,
    private readonly fases: FasesService,
  ) {}

  @Get()
  async list(
    @Query('id_area') id_area?: string,
    @Query('id_nivel') id_nivel?: string,
    @Query('estado') estado?: EstadoFiltro,
  ) {
    const area = id_area ? Number(id_area) : undefined;
    const nivel = id_nivel ? Number(id_nivel) : undefined;

    if (area && nivel) {
      const st = await this.fases.getStatus(
        area,
        nivel,
        PhaseType.CLASIFICACION,
      );
      if (st !== 'CERRADA' && st !== 'VALIDADA') {
        throw new HttpException(
          'Fase Bloqueada. La fase de clasificación aún no ha sido aprobada. Los reportes se habilitarán una vez que des el aval correspondiente.',
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
    @Query('estado') estado?: EstadoFiltro,
  ) {
    const area = id_area ? Number(id_area) : undefined;
    const nivel = id_nivel ? Number(id_nivel) : undefined;

    if (area && nivel) {
      const st = await this.fases.getStatus(
        area,
        nivel,
        PhaseType.CLASIFICACION,
      );
      if (st !== 'CERRADA' && st !== 'VALIDADA') {
        throw new HttpException(
          'Fase Bloqueada. La fase de clasificación aún no ha sido aprobada. Los reportes se habilitarán una vez que des el aval correspondiente.',
          HttpStatus.LOCKED,
        );
      }
    }

    return this.service.resumen({
      id_area: area,
      id_nivel: nivel,
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

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="clasificados.xlsx"',
    );
    res.send(buffer);
  }
}
