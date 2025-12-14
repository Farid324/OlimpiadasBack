// src/fases/fases.controller.ts
import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
  Get,
  Query,
  BadRequestException,
} from '@nestjs/common';
import * as fasesService from './fases.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RESPONSABLE, ADMIN } from '../auth/constants';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';
import { User } from '../common/decorators/user.decorator';
import { ClosePhaseDto, PhaseType } from './dto/close-phase.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RESPONSABLE)
@Controller('phases')
export class FasesController {
  constructor(private readonly fases: fasesService.FasesService) {}

  // HU-16, cerrar fase
  @Post(':id_area/:id_nivel/close')
  async close(
    @Param('id_area', ParseIntPipe) id_area: number,
    @Param('id_nivel', ParseIntPipe) id_nivel: number,
    @Body() dto: ClosePhaseDto,
    @User() user: JwtPayload,
  ) {
    if (
      !dto?.type ||
      (dto.type !== PhaseType.CLASIFICACION && dto.type !== PhaseType.FINAL)
    ) {
      throw new BadRequestException(
        'Tipo de fase inválido. Debe ser CLASIFICACION o FINAL.',
      );
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

  // HU-17, validar cierre de fase
  @Post(':id_area/:id_nivel/validate')
  async validate(
    @Param('id_area', ParseIntPipe) id_area: number,
    @Param('id_nivel', ParseIntPipe) id_nivel: number,
    @Body() dto: ClosePhaseDto,
    @User() user: JwtPayload,
  ) {
    if (
      !dto?.type ||
      (dto.type !== PhaseType.CLASIFICACION && dto.type !== PhaseType.FINAL)
    ) {
      throw new BadRequestException(
        'Tipo de fase inválido. Debe ser CLASIFICACION o FINAL.',
      );
    }
    const actor_id = Number(user.sub);
    return this.fases.validateClose({
      id_area,
      id_nivel,
      type: dto.type,
      actor_id,
      comment: dto.comentario,
    });
  }

  @Get('availability')
  @Roles(RESPONSABLE, ADMIN)
  async availability(@Query('type') type: PhaseType) {
    if (type !== PhaseType.CLASIFICACION && type !== PhaseType.FINAL) {
      throw new BadRequestException('Tipo de fase inválido.');
    }
    const unlocked = await this.fases.isPhaseEnabledGlobally(type);
    return {
      unlocked,
      message: unlocked ? null : this.fases.phaseLockedMessage(type),
    };
  }
}
