// src/gestiones/gestiones.module.ts
import { Module } from '@nestjs/common';
import { GestionesService } from './gestiones.service';
import { GestionesController } from './gestiones.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [GestionesService],
  controllers: [GestionesController],
  exports: [GestionesService],
})
export class GestionesModule {}
