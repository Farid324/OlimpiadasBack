//src/reportes/public.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { PublicReportService } from './public.service';

@Controller('public/reportes')
export class PublicReportController {
  constructor(private readonly publicService: PublicReportService) {}

  @Get('clasificados')
  async getClasificados(
    @Query('anio') anio?: string,
    @Query('area') area?: string,
    @Query('nivel') nivel?: string,
    @Query('ci') ci?: string,
  ) {
    const anioNum = anio ? Number(anio) : undefined;

    return this.publicService.getPublicClasificados({
      anio: Number.isFinite(anioNum) ? anioNum : undefined,
      area: area?.trim() || undefined,
      nivel: nivel?.trim() || undefined,
      ci: ci?.trim() || undefined,
    });
  }
}
