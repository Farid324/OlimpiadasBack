//src/tutores/tutores.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { TutoresService } from './tutores.service';
import { CreateTutorDto, GetTutoresQueryDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('tutores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR', 'RESPONSABLE_DE_AREA')
export class TutoresController {
  constructor(private readonly service: TutoresService) {}

  @Post()
  create(@Body() dto: CreateTutorDto) {
    return this.service.create(dto);
  }

  @Get()
  list(@Query() q: GetTutoresQueryDto) {
    return this.service.list({ q: q.q });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
}
