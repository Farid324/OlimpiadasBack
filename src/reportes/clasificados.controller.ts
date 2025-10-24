// src/reportes/clasificados.controller.ts
import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
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

  private async assertClasificacionOficial(
    id_area?: string,
    id_nivel?: string,
  ) {
    const area = id_area ? Number(id_area) : undefined;
    const nivel = id_nivel ? Number(id_nivel) : undefined;

    if (area && nivel) {
      const status = await this.fases
        .getStatus(area, nivel, 'CLASIFICACION')
        .catch(() => 'EN_PROCESO' as const);

      if (status !== 'CERRADA' && status !== 'VALIDADA') {
        throw new BadRequestException(
          'La fase de clasificación aún no está aprobada. No es posible generar reportes oficiales.',
        );
      }
    }
  }

  @Get()
  async list(
    @Query('id_area') id_area?: string,
    @Query('id_nivel') id_nivel?: string,
    @Query('estado') estado?: EstadoFiltro,
  ) {
    await this.assertClasificacionOficial(id_area, id_nivel); //gate oficial

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
    await this.assertClasificacionOficial(id_area, id_nivel); //gate oficial

    return this.service.resumen({
      id_area: id_area ? Number(id_area) : undefined,
      id_nivel: id_nivel ? Number(id_nivel) : undefined,
      estado: estado && estado !== 'TODOS' ? estado : undefined,
    });
  }
}
