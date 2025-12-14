//src/fases/fases.module.ts

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FasesService } from './fases.service';
import { PhaseGateService } from './phase-gate.service';
import { FasesController } from './fases.controller';

@Module({
  imports: [PrismaModule],
  providers: [FasesService, PhaseGateService],
  controllers: [FasesController],
  exports: [FasesService, PhaseGateService],
})
export class FasesModule {}
