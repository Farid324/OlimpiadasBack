import { Injectable } from '@nestjs/common';
import { FasesService } from './fases.service';

@Injectable()
export class PhaseGateService {
  constructor(private readonly fases: FasesService) {}

  async assertCanEditClasificacion(id_area: number, id_nivel: number) {
    await this.fases.assertPhaseIsEditable(id_area, id_nivel, 'CLASIFICACION');
  }

  async assertCanEditFinal(id_area: number, id_nivel: number) {
    await this.fases.assertPhaseIsEditable(id_area, id_nivel, 'FINAL');
  }
}
