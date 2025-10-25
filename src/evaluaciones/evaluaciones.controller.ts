import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { EvaluacionesService } from './evaluaciones.service';
import { RegistrarNotaDto } from './dto/registrar-nota.dto';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';
import type { Evaluacion } from './entities/evaluacion.entity';

@Controller('evaluaciones')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvaluacionesController {
  constructor(private readonly evaluacionesService: EvaluacionesService) {}

  @Get('mis-asignados')
  async getMisAsignados(
    @CurrentUser() user: JwtPayload,
  ): Promise<Evaluacion[]> {
    const idUsuario = parseInt(user.sub, 10); // convertir string a number
    return this.evaluacionesService.obtenerAsignados(idUsuario);
  }

  @Post(':id/nota')
  async registrarNota(
    @Param('id', ParseIntPipe) idEvaluacion: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RegistrarNotaDto,
  ): Promise<Evaluacion> {
    const idUsuario = parseInt(user.sub, 10);
    return this.evaluacionesService.registrarNota(idEvaluacion, idUsuario, dto);
  }
}
