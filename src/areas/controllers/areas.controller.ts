// src/areas/controllers/areas.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { AreasService } from '../services/areas.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateAreaDto } from '../dto/create-area.dto';

@Controller('areas')
@UseGuards(JwtAuthGuard)
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  // 🔹 Estadísticas generales (agrupado por área y niveles)
  @Get()
  async getAreas() {
    return await this.areasService.getAreasConEstadisticas();
  }

  // 🔹 Estadísticas para PANEL PRINCIPAL
  // ⚠️ CAMBIO AQUÍ: Llamamos al nuevo método que devuelve Métricas + Stats A/N
  @Get('panel-principal')
  async getAreasPanelPrincipal() {
    return await this.areasService.getDashboardData(); // <--- Mando el objeto completo
  }

  // Crear Área
  @Post()
  async create(@Body() data: CreateAreaDto) {
    return await this.areasService.create(data);
  }

  // Editar Área
  @Put(':id')
  async update(@Param('id') id: string, @Body() data: CreateAreaDto) {
    return await this.areasService.update(+id, data);
  }

  // Eliminar (Desactivar) Área
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.areasService.remove(+id);
  }
}