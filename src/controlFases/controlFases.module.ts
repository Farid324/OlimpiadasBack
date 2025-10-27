// src/controlFases/controlFases.module.ts
import { Module } from '@nestjs/common';
import { ControlFasesController } from './controlFases.controller';
import { ControlFasesService } from './controlFases.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],          // ⬅️ IMPORTANTE
  controllers: [ControlFasesController],
  providers: [ControlFasesService],
})
export class ControlFasesModule {}
