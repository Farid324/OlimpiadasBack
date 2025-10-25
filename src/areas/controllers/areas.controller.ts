import { Controller, Get, UseGuards } from '@nestjs/common';
import { AreasService } from '../services/areas.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// import { RolesGuard } from '../../common/guards/roles.guard'; // Ya no lo usamos aquí
// import { Roles } from '../../common/decorators/roles.decorator'; // Ya no lo usamos aquí
// import { ADMIN } from '../../auth/constants'; // Ya no lo usamos aquí

@Controller('areas')
@UseGuards(JwtAuthGuard)
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @Get()
  async getAreas() {
    console.log('PRUEBA DE REINICIO v2 - ESTE ES EL CÓDIGO NUEVO');
    const areas = await this.areasService.getAreasConEstadisticas();
    console.log('Datos devueltos por el servicio:', areas);
    return areas;
  }
}
