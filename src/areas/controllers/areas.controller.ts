// src/areas/controllers/areas.controller.ts
import { Controller, Get } from '@nestjs/common';
import { AreasService } from '../services/areas.service';

@Controller('areas')
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @Get()
  async getAreas() {
    console.log('💡 Llamada al Controller recibida'); // <-- LOG
    const areas = await this.areasService.getAreasConEstadisticas();
    console.log('💡 Datos devueltos por el servicio:', areas); // <-- LOG
    return areas;
  }
}
