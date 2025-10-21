//src/reportes/clasificados.controller.ts

import { Controller, Get, Query } from '@nestjs/common';
import { ClasificadosService } from './clasificados.service';

type EstadoFiltro = 'CLASIFICADO' | 'NO_CLASIFICADO' | 'DESCALIFICADO' | 'TODOS' | undefined;

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
