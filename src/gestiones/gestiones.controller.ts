// src/gestiones/gestiones.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
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
    const result = await this.gestiones.closeCurrentGestion();
    return {
      ok: true,
      gestion: result.gestion,
      areasArchivadas: result.areasArchivadas,
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

  // ===================== ENDPOINTS PARA HISTORIAL DE ÁREAS =====================

  /**
   * Obtener historial completo de áreas por gestiones cerradas
   * GET /gestiones/historial-areas
   */
  @Get('historial-areas')
  @Roles(ADMIN, RESPONSABLE)
  async getAreasHistorial() {
    const historial = await this.gestiones.getAreasHistorial();
    return { historial };
  }

  /**
   * Obtener lista de gestiones cerradas (solo metadatos)
   * GET /gestiones/cerradas
   */
  @Get('cerradas')
  @Roles(ADMIN, RESPONSABLE)
  async getGestionesCerradas() {
    const gestiones = await this.gestiones.getGestionesCerradas();
    return { gestiones };
  }

  /**
   * Obtener áreas de una gestión específica
   * GET /gestiones/:id/areas
   */
  @Get(':id/areas')
  @Roles(ADMIN, RESPONSABLE)
  async getAreasByGestion(@Param('id', ParseIntPipe) id: number) {
    const areas = await this.gestiones.getAreasByGestion(id);
    return { areas };
  }

  /**
   * Equipo académico (responsables y evaluadores) de la gestión abierta.
   * GET /gestiones/equipo-actual
   */
  @Get('equipo-actual')
  @Roles(ADMIN)
  async getEquipoActual() {
    return this.gestiones.getEquipoGestionActual();
  }
}
