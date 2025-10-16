// src/evaluaciones-admin/evaluaciones-admin.controller.ts
import {
  Controller,
  Get,
  Query,
  UseGuards,
  Patch,
  Body,
  Post,
  Req,
  Param,
} from '@nestjs/common';
import { EvaluacionesAdminService } from './evaluaciones.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ADMIN } from '../auth/constants';

@Controller('admin/evaluaciones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ADMIN)
export class EvaluacionesAdminController {
  constructor(private service: EvaluacionesAdminService) {}

  // GET /admin/evaluaciones?search=juan&filtro=PENDIENTE
  @Get()
  async listarCompetidores(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('filtro') filtro?: 'PENDIENTE' | 'EVALUADO' | 'TODOS',
  ) {
    // Ejemplo: obtener id de áreas administradas
    const idUsuario = Number(req.user.sub);

    const areas = await this.service['prisma'].responsables_area.findMany({
      where: { id_usuario: idUsuario },
      select: { id_area: true },
    });
    const idAreas = areas.map((a) => a.id_area);

    return this.service.listarCompetidores({ search, idAreas, filtro });
  }

  // POST /admin/evaluaciones/nota
  @Post('nota')
  async registrarNota(
    @Req() req: any,
    @Body()
    body: { idInscripcion: number; nota: number },
  ) {
    const idEvaluador = Number(req.user.sub);
    return this.service.registrarNota({
      idInscripcion: body.idInscripcion,
      idEvaluador,
      nota: body.nota,
    });
  }

  // PATCH /admin/evaluaciones/nota
  @Patch('nota')
  async editarNota(
    @Req() req: any,
    @Body()
    body: { idEvaluacion: number; nuevaNota: number },
  ) {
    const idUsuario = Number(req.user.sub);
    return this.service.editarNota({
      idEvaluacion: body.idEvaluacion,
      idUsuario,
      nuevaNota: body.nuevaNota,
    });
  }

  // evaluaciones-admin.controller.ts
  @Get(':idEvaluacion/logs')
  obtenerLogs(@Param('idEvaluacion') idEvaluacion: string) {
    const id = Number(idEvaluacion);
    return this.service.obtenerLogsCambios(id);
  }
}
