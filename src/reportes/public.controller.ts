//src/reportes/public.controller.ts
import { Controller, Get } from '@nestjs/common';
import { PublicReportService } from './public.service';

@Controller('public/reportes')
export class PublicReportController {
  constructor(private readonly publicService: PublicReportService) {}

  // ❗️ IMPORTANTE: Este endpoint no tiene @UseGuards, es público.
  @Get('clasificados')
  async getClasificados() {
    return this.publicService.getPublicClasificados();
  }
}
