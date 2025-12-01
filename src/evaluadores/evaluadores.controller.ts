// src/evaluadores/evaluadores.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Delete,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { EvaluadoresService } from './evaluadores.service';
import { CreateEvaluadorDto } from './dto/create-evaluador.dto';
import { UpdateEvaluadorDto } from './dto/update-evaluador.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ADMIN } from '../auth/constants';
import { AsignarOlimpistasDto } from './dto/asignar-olimpistas.dto';


@Controller('evaluadores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ADMIN,'RESPONSABLE_DE_AREA')
export class EvaluadoresController {
  constructor(private readonly service: EvaluadoresService) {}

  @Post()
  create(@Body() dto: CreateEvaluadorDto) {
    return this.service.create(dto);
  }

  // Soporte a búsquedas por q / telefono / ci (el front lo usa para duplicados)
  @Get()
  findAll(@Query() query: { q?: string; telefono?: string; ci?: string }) {
    return this.service.findAll(query);
  }

  @Post('asignar-olimpistas')
async asignarOlimpistas(@Body() dto: AsignarOlimpistasDto) {
  return this.service.asignarOlimpistas(dto);
}
@Get('asignar-olimpistas/estado')
async getEstadoAsignacion(@Query('id_area') id_area: string) {
  const idAreaNum = Number(id_area);
  return this.service.getEstadoAsignacionArea(idAreaNum);
}


  // 🔹 Necesario para "Editar"
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEvaluadorDto,
  ) {
    return this.service.update(id, dto);
  }

  // 🔹 Necesario para "Eliminar"
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
