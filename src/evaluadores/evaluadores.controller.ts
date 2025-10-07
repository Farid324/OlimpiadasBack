import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { EvaluadoresService } from './evaluadores.service';
import { CreateEvaluadorDto } from './dto/create-evaluador.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ADMIN } from '../auth/constants';

@Controller('evaluadores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ADMIN)
export class EvaluadoresController {
  constructor(private service: EvaluadoresService) {}

  @Get()
  async findAll(@Query('q') q?: string) {
    return this.service.findAll(q);
  }

  @Post()
  async create(@Body() dto: CreateEvaluadorDto) {
    return this.service.create(dto);
  }
}
