// src/fases/fases.controller.ts

import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FasesService, PhaseType } from './fases.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RESPONSABLE } from '../auth/constants';
import { ADMIN } from '../auth/constants';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';
import { User } from '../common/decorators/user.decorator';

class ClosePhaseDto {
  type!: PhaseType;
  comentario?: string;
}

@Controller('phases')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RESPONSABLE, ADMIN) // opcional permitir ADMIN
export class FasesController {
  constructor(private readonly fases: FasesService) {}

  @Post(':id_area/:id_nivel/close')
  async validateClose(
    @Param('id_area', ParseIntPipe) id_area: number,
    @Param('id_nivel', ParseIntPipe) id_nivel: number,
    @Body() dto: ClosePhaseDto,
    @User() user: JwtPayload,
  ) {
    if (!dto?.type || (dto.type !== 'CLASIFICACION' && dto.type !== 'FINAL')) {
      throw new Error('Tipo de fase inválido. Debe ser CLASIFICACION o FINAL.');
    }
    const actor_id = Number(user.sub);
    return this.fases.validateClose({
      id_area,
      id_nivel,
      type: dto.type,
      actor_id,
    });
  }
  async close(
    @Param('id_area', ParseIntPipe) id_area: number,
    @Param('id_nivel', ParseIntPipe) id_nivel: number,
    @Body() dto: ClosePhaseDto,
    @User() user: JwtPayload,
  ) {
    if (!dto?.type || (dto.type !== 'CLASIFICACION' && dto.type !== 'FINAL')) {
      throw new Error('Tipo de fase inválido. Debe ser CLASIFICACION o FINAL.');
    }
    const actor_id = Number(user.sub);

    return this.fases.closePhase({
      id_area,
      id_nivel,
      type: dto.type,
      actor_id,
      comment: dto.comentario,
    });
  }
}
