// src/evaluaciones/evaluaciones.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EvaluacionesAdminController } from './evaluaciones.controller';
import { EvaluacionesAdminService } from './evaluaciones.service';
import { EvaluacionesService } from './registrar-editar.service';
import { AdminEvaluacionesService } from './admin-evaluaciones.service';

@Module({
  imports: [PrismaModule],
  controllers: [EvaluacionesAdminController],
  providers: [
    EvaluacionesAdminService,
    EvaluacionesService,
    AdminEvaluacionesService,
  ],
})
export class EvaluacionesAdminModule {}
