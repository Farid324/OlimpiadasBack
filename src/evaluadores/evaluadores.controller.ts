import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { EvaluadoresService } from './evaluadores.service';
import { CreateEvaluadorDto } from './dto/create-evaluador.dto';
import { QueryEvaluadorDto } from './dto/query-evaluador.dto';

@Controller('evaluadores')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class EvaluadoresController {
  constructor(private readonly evaluadoresService: EvaluadoresService) {}

  @Get()
  async findAll(@Query() query: QueryEvaluadorDto) {
    return this.evaluadoresService.findAll(query);
  }

  @Post()
  async create(
    @Body()
    dto: CreateEvaluadorDto & { nombreCompleto?: string; id_areas?: number[] },
  ) {
    return this.evaluadoresService.create(dto);
  }

  @Get('check-telefono/:telefono')
  async existsByTelefono(@Param('telefono') telefono: string) {
    return this.evaluadoresService.existsByTelefono(telefono);
  }

  @Get('check-ci/:ci')
  async existsByCi(@Param('ci') ci: string) {
    return this.evaluadoresService.existsByCi(ci);
  }
}
