// src/evaluadores/evaluadores.module.ts
import { Module } from '@nestjs/common';
import { EvaluadoresController } from './evaluadores.controller';
import { EvaluadoresService } from './evaluadores.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  // PrismaModule ya exporta/provee PrismaService para el módulo
  imports: [PrismaModule],
  controllers: [EvaluadoresController],
  // Solo tu servicio; PrismaService lo trae PrismaModule
  providers: [EvaluadoresService],
  // Exporta el servicio si otros módulos lo necesitan
  exports: [EvaluadoresService],
})
export class EvaluadoresModule {}
