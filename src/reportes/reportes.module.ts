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

// ==================== PUBLICACION ====================
import { PublicacionController } from './publicacion/publicacion.controller';
import { PublicacionService } from './publicacion/publicacion.service';

@Module({
  imports: [PrismaModule, FasesModule],
  controllers: [
    ClasificadosController,
    PublicReportController,
    CeremoniaController, // 👈 NUEVO
    PublicacionController,
  ],
  providers: [
    ClasificadosService,
    PublicReportService,
    CeremoniaService, // 👈 NUEVO
    PublicacionService,
  ],
})
export class ReportesModule {}
