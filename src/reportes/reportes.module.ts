// src/reportes/reportes.module.ts

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FasesModule } from '../fases/fases.module';

// ==================== EXISTENTES ====================
import { ClasificadosController } from './clasificados.controller';
import { ClasificadosService } from './clasificados.service';
import { PublicReportController } from './public.controller';
import { PublicReportService } from './public.service';

// ==================== NUEVOS: CEREMONIA ====================
import { CeremoniaController } from './ceremonia/ceremonia.controller';
import { CeremoniaService } from './ceremonia/ceremonia.service';

@Module({
  imports: [PrismaModule, FasesModule],
  controllers: [
    ClasificadosController,
    PublicReportController,
    CeremoniaController, // 👈 NUEVO
  ],
  providers: [
    ClasificadosService,
    PublicReportService,
    CeremoniaService, // 👈 NUEVO
  ],
})
export class ReportesModule {}
