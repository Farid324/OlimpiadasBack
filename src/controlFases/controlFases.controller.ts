import { Controller, Get } from '@nestjs/common';
import { ControlFasesService } from './controlFases.service';
import { ControlFasesResponse } from './controlFases.types';

@Controller('control-fases')
export class ControlFasesController {
  constructor(private readonly service: ControlFasesService) {}

  @Get()
  async findAll(): Promise<ControlFasesResponse> {
    return this.service.getControlFases();
  }
}
