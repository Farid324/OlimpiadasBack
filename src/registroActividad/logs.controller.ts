import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { LogsService } from './logs.service';
import { CreateLogDto } from './dto/create-log.dto';
import { QueryLogsDto } from './dto/query-logs.dto';

@Controller('logs')
export class LogsController {
  constructor(private logsService: LogsService) {}

  // Crear un log
  @Post()
  create(@Body() dto: CreateLogDto) {
    return this.logsService.create(dto);
  }

  // Obtener logs en formato que espera el front
  @Get()
  async findAll(@Query() query: QueryLogsDto) {
    const { items } = await this.logsService.findAll(query);
    return items; // Devuelve solo el array de logs
  }
}

//