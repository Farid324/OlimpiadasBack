import { Module } from '@nestjs/common';
import { EvaluacionesController } from './evaluaciones.controller';
import { EvaluacionesService } from './evaluaciones.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [EvaluacionesController],
  providers: [EvaluacionesService, PrismaService],
})
export class EvaluacionesModule {}
