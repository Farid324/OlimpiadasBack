//src/fases/fases.module.ts

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FasesService } from './fases.service';
import { PhaseGateService } from './phase-gate.service';

@Module({
  imports: [PrismaModule],
  providers: [FasesService, PhaseGateService],
  exports: [FasesService, PhaseGateService],
})
export class FasesModule {}
