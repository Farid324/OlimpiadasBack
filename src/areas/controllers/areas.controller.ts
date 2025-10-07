// src/areas/controllers/areas.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AreasService } from '../services/areas.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ADMIN } from '../../auth/constants';

@Controller('areas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ADMIN)
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @Get()
  async getAreas() {
    console.log('💡 Llamada al Controller recibida');
    const areas = await this.areasService.getAreasConEstadisticas();
    console.log('💡 Datos devueltos por el servicio:', areas);
    return areas;
  }
}
