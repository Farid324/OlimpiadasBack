// src/gestiones/gestiones.controller.ts
import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GestionesService } from './gestiones.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ADMIN, RESPONSABLE } from '../auth/constants';
import { OpenGestionDto } from './dto/open-gestion.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('gestiones')
export class GestionesController {
  constructor(private readonly gestiones: GestionesService) {}

  @Get('actual')
  @Roles(ADMIN, RESPONSABLE)
  async getActual() {
    const gestion = await this.gestiones.getCurrentOpenGestion();
    return { gestion };
  }

  @Get('can-close')
  @Roles(ADMIN)
  async canClose() {
    return this.gestiones.getCloseEligibility();
  }

  @Post('close')
  @Roles(ADMIN)
  async close() {
    const gestion = await this.gestiones.closeCurrentGestion();
    return {
      ok: true,
      gestion,
    };
  }

  @Post('open')
  @Roles(ADMIN)
  async open(@Body() dto: OpenGestionDto) {
    const gestion = await this.gestiones.openNewGestion(dto.anio, dto.nombre);
    return {
      ok: true,
      gestion,
    };
  }

  @Get()
  @Roles(ADMIN)
  async list() {
    const gestiones = await this.gestiones.listAll();
    return { gestiones };
  }
}
