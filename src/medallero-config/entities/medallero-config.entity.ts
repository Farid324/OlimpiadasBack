//src/medallero-config/entities/medallero-config.entity.ts
import { areas } from '@prisma/client';

export class MedalleroConfigEntity {
  id_medallero: number;
  id_area: number;
  oros: number;
  platas: number;
  bronces: number;
  menciones: number;
  vigente_desde?: Date | null;
  vigente_hasta?: Date | null;
  area?: areas;
}
