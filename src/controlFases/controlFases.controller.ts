//src/controlFases/controlFases.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ControlFasesService } from './controlFases.service';
import { ControlFasesResponse } from './controlFases.types';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ADMIN, RESPONSABLE } from '../auth/constants';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RESPONSABLE, ADMIN) 
@Controller('control-fases')
export class ControlFasesController {
  constructor(private readonly service: ControlFasesService) {}

  @Get()
  async findAll(): Promise<ControlFasesResponse> {
    return this.service.getControlFases();
  }
}
