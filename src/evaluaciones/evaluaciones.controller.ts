import {
  Controller,
  Get,
  Query,
  UseGuards,
  Put,
  Body,
  Post,
  Req,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { Request } from 'express';

import { EvaluacionesAdminService } from './evaluaciones.service';
import { EvaluacionesService } from './registrar-editar.service';
import { EditarNotaDto, RegistrarNotaDto } from './dto/registrar-nota.dto';
import { AdminEvaluacionesService } from './admin-evaluaciones.service';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('admin/evaluaciones')
@UseGuards(JwtAuthGuard)
export class EvaluacionesAdminController {
  constructor(
    private service: EvaluacionesAdminService,
    private registrarEditarService: EvaluacionesService,
    private adminEvaluaciones: AdminEvaluacionesService,
  ) {}

  // ====================  VISTA EVALUADOR  ====================

  // Lista con filtros (usa áreas asignadas al evaluador)
  @Get('mis-competidores')
  async listarMisCompetidores(
    @Req() req: RequestWithUser,
    @Query('search') search?: string,
    @Query('filtro') filtro?: 'PENDIENTE' | 'EVALUADO' | 'TODOS',
    @Query('id_area') id_area?: string,
    @Query('id_nivel') id_nivel?: string,
  ) {
    const idUsuario = Number(req.user.sub);

    // Áreas asignadas al evaluador
    const areas = await this.service['prisma'].evaluadores_area.findMany({
      where: { id_usuario: idUsuario, activo: true },
      select: { id_area: true },
    });
    const idAreas = areas.map((a) => a.id_area);

    // Llamada al service con filtros normalizados
    return this.service.listarCompetidores({
      search,
      idAreas,
      filtro,
      id_area: id_area ? Number(id_area) : undefined,
      id_nivel: id_nivel ? Number(id_nivel) : undefined,
    });
  }

  // Resumen para las cards de la vista de evaluador
  @Get('resumen')
  async getResumenEvaluador(@Req() req: RequestWithUser) {
    const idEvaluador = Number(req.user.sub);
    return this.service.getResumenEvaluador(idEvaluador);
  }

  // Registrar / Editar nota
  @Post('registrar-nota/:idFase')
  async registrarNota(
    @Body() dto: RegistrarNotaDto,
    @Param('idFase') idFaseParam: string,
  ) {
    const idFase = Number(idFaseParam);
    if (isNaN(idFase) || idFase < 1) {
      // Manejo básico de error si la fase no es válida
      throw new BadRequestException('ID de fase inválido o faltante.');
    }
    return this.registrarEditarService.registrarNota(dto, idFase);
  }

  @Put('editar-nota/:idFase')
  async editarNota(
    @Body() dto: EditarNotaDto,
    @Param('idFase') idFaseParam: string,
  ) {
    const idFase = Number(idFaseParam);
    if (isNaN(idFase) || idFase < 1) {
      // Manejo básico de error si la fase no es válida
      throw new BadRequestException('ID de fase inválido o faltante.');
    }
    return this.registrarEditarService.editarNota(dto, idFase);
  }

  // ====================  VISTA ADMIN  ====================

  @Get('adminLista')
  async listar(
    @Query('areaId') areaId?: string,
    @Query('nivelId') nivelId?: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.adminEvaluaciones.listarEvaluacionesYInscripciones({
      areaId: areaId ? Number(areaId) : undefined,
      nivelId: nivelId ? Number(nivelId) : undefined,
      search,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Get('adminStats')
  async stats(
    @Query('areaId') areaId?: string,
    @Query('nivelId') nivelId?: string,
  ) {
    return this.adminEvaluaciones.estadisticasPorAreaNivel(
      areaId ? Number(areaId) : undefined,
      nivelId ? Number(nivelId) : undefined,
    );
  }

  @Get('areas')
  listAreas() {
    return this.adminEvaluaciones.listarAreas();
  }

  @Get('niveles')
  listNiveles() {
    return this.adminEvaluaciones.listarNiveles();
  }

  @Get(':id')
  async getDetalle(@Param('id') id: string) {
    return this.adminEvaluaciones.obtenerDetalleEvaluacion(Number(id));
  }
}
