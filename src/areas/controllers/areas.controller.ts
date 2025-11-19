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
// import { RolesGuard } from '../../common/guards/roles.guard'; // Ya no lo usamos aquí
// import { Roles } from '../../common/decorators/roles.decorator'; // Ya no lo usamos aquí
// import { ADMIN } from '../../auth/constants'; // Ya no lo usamos aquí

@Controller('areas')
@UseGuards(JwtAuthGuard)
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  /*@Get()
  async getAreas() {
    console.log('PRUEBA DE REINICIO v2 - ESTE ES EL CÓDIGO NUEVO');
    const areas = await this.areasService.getAreasConEstadisticas();
    console.log('Datos devueltos por el servicio:', areas);
    return areas;
  }*/
  @Get()
  async getAreas() {
    return await this.areasService.getAreasConEstadisticas();
  }

  // NUEVO: Crear Área
  @Post()
  async create(@Body() data: CreateAreaDto) {
    return await this.areasService.create(data);
  }

  // NUEVO: Editar Área
  @Put(':id')
  async update(@Param('id') id: string, @Body() data: CreateAreaDto) {
    return await this.areasService.update(+id, data);
  }

  // NUEVO: Eliminar (Desactivar) Área
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.areasService.remove(+id);
  }
}
