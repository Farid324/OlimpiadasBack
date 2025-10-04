import { Controller, Get } from '@nestjs/common';
import { AreasService } from '../services/areas.service';
import { AreaDto } from '../dto/get-areas.dto';

@Controller('areas')
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @Get()
  async getAreas(): Promise<AreaDto[]> {
    return this.areasService.getAreasConEstadisticas();
  }
}
