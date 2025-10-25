//src/niveles/niveles/niveles.controller.ts

import { Controller, Get } from '@nestjs/common';
import { NivelesService } from './niveles.service';

@Controller('niveles')
export class NivelesController {
  constructor(private readonly nivelesService: NivelesService) {}

  @Get()
  async findAll() {
    const list = await this.nivelesService.findAll();
    return list.map((n) => ({ id: n.id_nivel, nombre: n.nombre_nivel }));
  }
}
