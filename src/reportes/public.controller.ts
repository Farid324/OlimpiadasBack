// src/reportes/public.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { PublicReportService } from './public.service';

@Controller('public/reportes')
export class PublicReportController {
  constructor(private readonly publicService: PublicReportService) {}

  /**
   * Endpoint público de clasificados.
   *
   * Comportamiento:
   * - Sin parámetros => usa la última gestión CERRADA.
   * - Con ?anio=YYYY   => intenta usar esa gestión (si está CERRADA).
   * - Filtros opcionales:
   *    - area  => nombre del área (match insensible a mayúsculas).
   *    - nivel => nombre del nivel (Primaria / Secundaria / texto que coincida con nombre_nivel).
   *    - ci    => CI exacto del competidor.
   */
  @Get('clasificados')
  async getClasificados(
    @Query('anio') anioRaw?: string,
    @Query('area') area?: string,
    @Query('nivel') nivel?: string,
    @Query('ci') ci?: string,
  ) {
    const anio =
      anioRaw && !Number.isNaN(Number(anioRaw)) ? Number(anioRaw) : undefined;

    return this.publicService.getPublicClasificados({
      anio,
      area,
      nivel,
      ci,
    });
  }
}
