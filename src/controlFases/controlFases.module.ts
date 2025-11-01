// src/controlFases/controlFases.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';

import { ControlFasesController } from './controlFases.controller';
import { ControlFasesService } from './controlFases.service';

// NUEVO: panel del responsable
import { ControlFasesRespController } from './responsable/controlFasesResp.controller';
import { ControlFasesRespService } from './responsable/controlFasesResp.service';

@Module({
  imports: [PrismaModule],
  controllers: [ControlFasesController, ControlFasesRespController],
  providers: [ControlFasesService, ControlFasesRespService],
  exports: [ControlFasesService, ControlFasesRespService],
})
export class ControlFasesModule {}
