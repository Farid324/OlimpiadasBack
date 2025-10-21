//src/reportes/reportes.ts

import { Module } from '@nestjs/common';
import { ClasificadosController } from './clasificados.controller';
import { ClasificadosService } from './clasificados.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ClasificadosController],
  providers: [ClasificadosService],
})
export class ReportesModule {}