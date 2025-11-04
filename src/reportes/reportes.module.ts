//src/reportes/reportes.module.ts

import { Module } from '@nestjs/common';
import { ClasificadosController } from './clasificados.controller';
import { ClasificadosService } from './clasificados.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FasesModule } from '../fases/fases.module';
import { PublicReportController } from './public.controller'; // 👈 AÑADIR
import { PublicReportService } from './public.service'; // 👈 AÑADIR
//premiadosTAB
import { PremiadosController } from './premiados.controller';
import { PremiadosService } from './premiados.service';
@Module({
  imports: [PrismaModule, FasesModule],
  controllers: [
    ClasificadosController,
    PublicReportController,
    PremiadosController,
  ], // 👈 AÑADIR
  providers: [ClasificadosService, PublicReportService, PremiadosService],
})
export class ReportesModule {}
