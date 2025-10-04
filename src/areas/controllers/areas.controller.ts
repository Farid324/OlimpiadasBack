import { Controller, Get } from '@nestjs/common';
import { AreasService } from '../services/areas.service';
import { AreaDto } from '../dto/get-areas.dto';

@Controller('areas')
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @Get()
  async getAreas(): Promise<AreaDto[]> {
    const areas = await this.areasService.getAreasConEstadisticas();
    return areas.map(area => ({
      id_area: Number(area.id_area),
      nombre_area: area.nombre_area,
      estado: String(area.estado),
      niveles: area.nivel
        ? [{
            id_nivel: Number(area.nivel.id_nivel),
            nombre_nivel: area.nivel.nombre_nivel,
            inscritos: area.inscritos
          }]
        : []
    }));
  }
}
