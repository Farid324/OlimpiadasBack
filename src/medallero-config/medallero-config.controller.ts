//src/medallero-config/medallero-config.controller.ts
import { Controller, Get, Put, Post, Body, Param, Logger } from '@nestjs/common';
import { MedalleroConfigService } from './medallero-config.service';
import { UpdateMedalleroConfigDto } from './dto/update-medallero-config.dto';
import { CreateMedalleroConfigDto } from './dto/create-medallero-config.dto';

@Controller('medallero-config')
export class MedalleroConfigController {
  private readonly logger = new Logger(MedalleroConfigController.name);

  constructor(private readonly service: MedalleroConfigService) {}

  /** Obtener todas las áreas con su medallero y participantes */
  @Get()
  async findAll() {
    this.logger.debug('GET /medallero-config');
    return this.service.findAll();
  }

  /** Obtener una configuración específica por id */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    this.logger.debug(`GET /medallero-config/${id}`);
    return this.service.findOne(+id);
  }

  /** Crear un nuevo medallero para un área */
  @Post()
  async create(@Body() dto: CreateMedalleroConfigDto) {
    this.logger.debug(`POST /medallero-config (area ${dto.id_area})`);
    // Reutilizamos la función de creación de service en vez de "update(0,...)"
    return this.service.create(dto);
  }

  /** Actualizar medallero existente */
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateMedalleroConfigDto) {
    this.logger.debug(`PUT /medallero-config/${id}`);
    return this.service.update(+id, dto);
  }
}



