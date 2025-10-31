// src/evaluaciones-admin/evaluaciones-admin.controller.ts
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
} from '@nestjs/common';
import { EvaluacionesAdminService } from './evaluaciones.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { Request } from 'express';
import { EvaluacionesService } from './registrar-editar.service';
import { EditarNotaDto, RegistrarNotaDto } from './dto/registrar-nota.dto';
import { AdminEvaluacionesService } from './admin-evaluaciones.service';

// ✅ Declaración de request tipado
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

  // @Post('nota')
  // async registrarNota(
  //   @Req() req: RequestWithUser,
  //   @Body() body: { idInscripcion: number; nota: number },
  // ) {
  //   const idEvaluador = Number(req.user.sub);
  //   return this.service.registrarNota({
  //     idInscripcion: body.idInscripcion,
  //     idEvaluador,
  //     nota: body.nota,
  //   });
  // }

  // @Patch('nota')
  // async editarNota(
  //   @Req() req: RequestWithUser,
  //   @Body() body: { idEvaluacion: number; nuevaNota: number },
  // ) {
  //   const idUsuario = Number(req.user.sub);
  //   return this.service.editarNota({
  //     idEvaluacion: body.idEvaluacion,
  //     idUsuario,
  //     nuevaNota: body.nuevaNota,
  //   });
  // }

  // @Get(':idEvaluacion/logs')
  // obtenerLogs(@Param('idEvaluacion') idEvaluacion: string) {
  //   const id = Number(idEvaluacion);
  //   return this.service.obtenerLogsCambios(id);
  // }
  @Post('registrar-nota')
  async registrarNota(@Body() dto: RegistrarNotaDto) {
    return this.registrarEditarService.registrarNota(dto);
  }

  @Put('editar-nota')
  async editarNota(@Body() dto: EditarNotaDto) {
    return this.registrarEditarService.editarNota(dto);
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
  // GET /admin/evaluaciones/lista
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
  @Get('areas') listAreas() {
    return this.adminEvaluaciones.listarAreas();
  }
  @Get('niveles') listNiveles() {
    return this.adminEvaluaciones.listarNiveles();
  }
  @Get(':id')
  async getDetalle(@Param('id') id: string) {
    return this.adminEvaluaciones.obtenerDetalleEvaluacion(Number(id));
  }
}
