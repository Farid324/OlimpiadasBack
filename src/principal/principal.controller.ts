import { Controller, Get, Query, Param, ParseIntPipe } from '@nestjs/common';
import { PrincipalService } from './principal.service';
import { CompetidorListadoDto, MedalleroResumenDto } from './dto/index';
import { tipo_premio } from '@prisma/client';

@Controller('principal')
export class PrincipalController {
  constructor(private readonly principalService: PrincipalService) {}

  /**
   * Endpoint para las cards de resumen (Clasificando, Medallas) de la GESTIÓN ACTIVA.
   * La ID de la gestión se obtiene internamente en el Service.
   */
  @Get('resumen-medallero')
  async getResumenMedallero(): Promise<MedalleroResumenDto> {
    return this.principalService.getResumenMedallero();
  }

  // --- CLASIFICADOS 2025 ---

  /**
   * Obtiene la lista de competidores para una fase específica de la gestión activa.
   * @param fase - 'clasificatoria' o 'final'.
   * @param idArea - Filtro por área.
   * @param medallaTipo - Filtro por medalla.
   */
  @Get('competidores/:fase')
  async getCompetidoresPorFase(
    @Param('fase') fase: 'clasificatoria' | 'final',
    @Query('idArea', new ParseIntPipe({ optional: true })) idArea?: number,
    @Query('medallaTipo') medallaTipo?: tipo_premio,
  ): Promise<CompetidorListadoDto[]> {
    if (fase === 'clasificatoria') {
      return this.principalService.getCompetidoresClasificatoria(idArea, medallaTipo);
    }
    
    if (fase === 'final') {
      return this.principalService.getCompetidoresFaseFinal(idArea, medallaTipo);
    }

    return [];
  }

  // --- HISTORICO ---

  /**
   * Obtiene la lista de años de las gestiones cerradas para el filtro del Histórico.
   */
  @Get('historico/anios')
  async getAniosHistorico(): Promise<{ anio: number }[]> {
    return this.principalService.getAniosHistorico();
  }

  /**
   * Obtiene la lista de competidores para la pestaña de Histórico.
   * @param anio - El año de la gestión CERRADA.
   * @param idArea - Filtro por área.
   * @param medallaTipo - Filtro por medalla.
   */
  @Get('historico/competidores/:anio')
  async getCompetidoresHistorico(
    @Param('anio', ParseIntPipe) anio: number, // Usamos ParseIntPipe para asegurar que 'anio' es un número
    @Query('idArea', new ParseIntPipe({ optional: true })) idArea?: number,
    @Query('medallaTipo') medallaTipo?: tipo_premio,
  ): Promise<CompetidorListadoDto[]> {
    return this.principalService.getCompetidoresHistorico(anio, idArea, medallaTipo);
  }
}