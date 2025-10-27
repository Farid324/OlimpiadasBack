// src/fases/phase-gate.service.ts
import { Injectable } from '@nestjs/common';
import { FasesService } from './fases.service';
import { PhaseType } from './dto/close-phase.dto';

@Injectable()
export class PhaseGateService {
  constructor(private readonly fases: FasesService) {}

  async assertCanEditClasificacion(id_area: number, id_nivel: number) {
    await this.fases.assertPhaseIsEditable(
      id_area,
      id_nivel,
      PhaseType.CLASIFICACION,
    );
  }

  async assertCanEditFinal(id_area: number, id_nivel: number) {
    await this.fases.assertPhaseIsEditable(id_area, id_nivel, PhaseType.FINAL);
  }
}
