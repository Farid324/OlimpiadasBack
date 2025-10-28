//src/reportes/reportes.module.ts

import { Module } from '@nestjs/common';
import { ClasificadosController } from './clasificados.controller';
import { ClasificadosService } from './clasificados.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FasesModule } from '../fases/fases.module';
import { PublicReportController } from './public.controller'; // 👈 AÑADIR
import { PublicReportService } from './public.service'; // 👈 AÑADIR
@Module({
  imports: [PrismaModule, FasesModule],
  controllers: [ClasificadosController, PublicReportController], // 👈 AÑADIR
  providers: [ClasificadosService, PublicReportService],
})
export class ReportesModule {}
