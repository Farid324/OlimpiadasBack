//src/reportes/reportes.module.ts

import { Module } from '@nestjs/common';
import { ClasificadosController } from './clasificados.controller';
import { ClasificadosService } from './clasificados.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FasesModule } from '../fases/fases.module';

@Module({
  imports: [PrismaModule, FasesModule],
  controllers: [ClasificadosController],
  providers: [ClasificadosService],
})
export class ReportesModule {}
