// src/reportes/clasificados.controller.ts
import {
  Controller,
  Get,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ClasificadosService } from './clasificados.service';
import { FasesService } from '../fases/fases.service';

type EstadoFiltro =
  | 'CLASIFICADO'
  | 'NO_CLASIFICADO'
  | 'DESCALIFICADO'
  | 'TODOS'
  | undefined;

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
      const st = await this.fases.getStatus(area, nivel, 'CLASIFICACION');
      if (st !== 'CERRADA' && st !== 'VALIDADA') {
        throw new HttpException(
          'Fase Bloqueada. La fase de clasificación aún no ha sido aprobada. Los reportes se habilitarán una vez que des el aval correspondiente.',
          HttpStatus.LOCKED, // 423
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
      const st = await this.fases.getStatus(area, nivel, 'CLASIFICACION');
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
}
