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
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { Request } from 'express';

// ✅ Declaración de request tipado
interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('admin/evaluaciones')
@UseGuards(JwtAuthGuard)
export class EvaluacionesAdminController {
  constructor(private service: EvaluacionesAdminService) {}

  @Get('lista')
  async listarCompetidores(
    @Req() req: RequestWithUser,
    @Query('search') search?: string,
    @Query('filtro') filtro?: 'PENDIENTE' | 'EVALUADO' | 'TODOS',
  ) {
    const idUsuario = Number(req.user.sub);

    const areas = await this.service['prisma'].evaluadores_area.findMany({
      where: { id_usuario: idUsuario },
      select: { id_area: true },
    });
    console.log('Evaluador areas:', areas);
    const idAreas = areas.map((a) => a.id_area);

    return this.service.listarCompetidores({ search, idAreas, filtro });
  }

  @Post('nota')
  async registrarNota(
    @Req() req: RequestWithUser,
    @Body() body: { idInscripcion: number; nota: number },
  ) {
    const idEvaluador = Number(req.user.sub);
    return this.service.registrarNota({
      idInscripcion: body.idInscripcion,
      idEvaluador,
      nota: body.nota,
    });
  }

  @Patch('nota')
  async editarNota(
    @Req() req: RequestWithUser,
    @Body() body: { idEvaluacion: number; nuevaNota: number },
  ) {
    const idUsuario = Number(req.user.sub);
    return this.service.editarNota({
      idEvaluacion: body.idEvaluacion,
      idUsuario,
      nuevaNota: body.nuevaNota,
    });
  }

  @Get(':idEvaluacion/logs')
  obtenerLogs(@Param('idEvaluacion') idEvaluacion: string) {
    const id = Number(idEvaluacion);
    return this.service.obtenerLogsCambios(id);
  }

  @Get('mis-competidores')
  async obtenerCompetidoresDeMisAreas(@Req() req: RequestWithUser) {
    const idEvaluador = Number(req.user.sub);
    console.log('Evaluador autenticado:', idEvaluador);
    return this.service.obtenerCompetidoresDeEvaluador(idEvaluador);
  }
  // src/evaluaciones-admin/evaluaciones-admin.controller.ts
  @Get('resumen')
  async getResumenEvaluador(@Req() req: RequestWithUser) {
    const idEvaluador = Number(req.user.sub);
    const resumen = await this.service.getResumenEvaluador(idEvaluador);
    console.log('[BACKEND] resumen:', resumen);
    return resumen;
  }
}
