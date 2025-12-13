// src/principal/principal.controller.ts
import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { PrincipalService } from './principal.service';
import { CompetidorListadoDto, MedalleroResumenDto } from './dto';
import { tipo_premio } from '@prisma/client';

@Controller('principal')
export class PrincipalController {
  constructor(private readonly principalService: PrincipalService) {}

  // Gestión activa - Clasificatoria
  @Get('competidores/clasificatoria')
  async getCompetidoresClasificatoria(
    @Query('idArea', new ParseIntPipe({ optional: true })) idArea?: number,
  ): Promise<CompetidorListadoDto[]> {
    return this.principalService.getCompetidoresClasificatoria(idArea);
  }

  // Gestión activa - Final
  @Get('competidores/final')
  async getCompetidoresFaseFinal(
    @Query('idArea', new ParseIntPipe({ optional: true })) idArea?: number,
    @Query('medallaTipo') medallaTipo?: tipo_premio,
  ): Promise<CompetidorListadoDto[]> {
    // valida medallaTipo
    if (medallaTipo && !Object.values(tipo_premio).includes(medallaTipo)) {
      throw new BadRequestException(
        'El tipo de medalla proporcionado no es válido.',
      );
    }
    return this.principalService.getCompetidoresFaseFinal(idArea, medallaTipo);
  }

  // Resumen de medallero (gestión activa)
  @Get('medallero-resumen')
  async getResumenMedallero(): Promise<MedalleroResumenDto> {
    return this.principalService.getResumenMedallero();
  }

  // Histórico - años disponibles
  @Get('historico/anios')
  async getAniosHistorico(): Promise<number[]> {
    return this.principalService.getAniosHistorico();
  }

  // Histórico - competidores por año (solo gestiones CERRADAS)
  @Get('historico/competidores')
  async getCompetidoresHistorico(
    @Query('anio', ParseIntPipe) anio: number,
    @Query('idArea', new ParseIntPipe({ optional: true })) idArea?: number,
    @Query('medallaTipo') medallaTipo?: tipo_premio,
  ): Promise<CompetidorListadoDto[]> {
    if (medallaTipo && !Object.values(tipo_premio).includes(medallaTipo)) {
      throw new BadRequestException(
        'El tipo de medalla proporcionado no es válido.',
      );
    }
    return this.principalService.getCompetidoresHistorico(
      anio,
      idArea,
      medallaTipo,
    );
  }
}
