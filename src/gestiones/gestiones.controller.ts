// /src/gestiones/gestiones.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
  Query,
} from '@nestjs/common';
import { GestionesService } from './gestiones.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ADMIN, RESPONSABLE } from '../auth/constants';
import { OpenGestionDto } from './dto/open-gestion.dto';
import { EquipoGestionQueryDto } from './dto/equipo-gestion.query';

// DTOs de query para histórico
import { OlimpistasHistorialQueryDto } from './dto/olimpistas-historial.query';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('gestiones')
export class GestionesController {
  constructor(private readonly gestiones: GestionesService) {}

  // ===================== GESTIÓN ACTUAL =====================

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

  // ===================== HISTORIAL ÁREAS =====================

  @Get('historial-areas')
  @Roles(ADMIN, RESPONSABLE)
  async getAreasHistorial() {
    const historial = await this.gestiones.getAreasHistorial();
    return { historial };
  }

  @Get('cerradas')
  @Roles(ADMIN, RESPONSABLE)
  async getGestionesCerradas() {
    const gestiones = await this.gestiones.getGestionesCerradas();
    return { gestiones };
  }

  @Get('equipo-actual')
  @Roles(ADMIN)
  async getEquipoActual() {
    return this.gestiones.getEquipoGestionActual();
  }

  @Get('equipo')
  @Roles(ADMIN)
  async getEquipoByGestion(@Query() query: EquipoGestionQueryDto) {
    if (!query.id_gestion) {
      return this.gestiones.getEquipoGestionActual();
    }
    return this.gestiones.getEquipoByGestionId(query.id_gestion);
  }

  // ===================== HISTORIAL (RUTAS CON :id AL FINAL) =====================

  @Get(':id/areas')
  @Roles(ADMIN, RESPONSABLE)
  async getAreasByGestion(@Param('id', ParseIntPipe) id: number) {
    const areas = await this.gestiones.getAreasByGestion(id);
    return { areas };
  }

  /**
   * Obtener olimpistas (genérico) de una gestión SOLO si está CERRADA
   * GET /gestiones/:id/olimpistas
   */
  @Get(':id/olimpistas')
  @Roles(ADMIN, RESPONSABLE)
  async getOlimpistasByGestion(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: OlimpistasHistorialQueryDto,
  ) {
    const olimpistas = await this.gestiones.getOlimpistasByGestionCerrada(id, {
      area: query.area,
      q: query.q,
    });
    return { olimpistas };
  }

  /**
   * CLASIFICADOS (Tab "CLASIFICADOS") por gestión cerrada
   * GET /gestiones/:id/olimpistas-clasificados
   */
  @Get(':id/olimpistas-clasificados')
  @Roles(ADMIN, RESPONSABLE)
  async getOlimpistasClasificadosByGestion(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: OlimpistasHistorialQueryDto,
  ) {
    const olimpistas =
      await this.gestiones.getOlimpistasClasificadosByGestionCerrada(id, {
        area: query.area,
        q: query.q,
      });
    return { olimpistas };
  }

  /**
   * FINALISTAS (Tab "FINALISTAS") por gestión cerrada + medalla materializada
   * GET /gestiones/:id/olimpistas-finalistas
   */
  @Get(':id/olimpistas-finalistas')
  @Roles(ADMIN, RESPONSABLE)
  async getOlimpistasFinalistasByGestion(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: OlimpistasHistorialQueryDto,
  ) {
    const olimpistas =
      await this.gestiones.getOlimpistasFinalistasByGestionCerrada(id, {
        area: query.area,
        q: query.q,
      });
    return { olimpistas };
  }

  /**
   * Áreas disponibles dentro del histórico de olimpistas (para filtro del tab)
   * GET /gestiones/:id/olimpistas-areas
   */
  @Get(':id/olimpistas-areas')
  @Roles(ADMIN, RESPONSABLE)
  async getOlimpistasAreasByGestion(@Param('id', ParseIntPipe) id: number) {
    const areas = await this.gestiones.getAreasDisponiblesDeGestionCerrada(id);
    return { areas };
  }
}
