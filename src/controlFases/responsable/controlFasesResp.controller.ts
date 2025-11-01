//src/controlFases/responsable/controlFasesResp.controller.ts

import {
  BadRequestException,
  Controller,
  Get,
  Req,
  Param,
  UseGuards,
  Post,
} from '@nestjs/common';
import type { Request } from 'express';
import { ControlFasesRespService } from './controlFasesResp.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { FasesService } from '../../fases/fases.service';
import { PhaseType } from '../../fases/dto/close-phase.dto';
import { ADMIN, RESPONSABLE } from '../../auth/constants';
import { Roles } from '../../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('control-fases/responsables')
export class ControlFasesRespController {
  constructor(
    private readonly service: ControlFasesRespService,
    private readonly fases: FasesService,
  ) {}

  @Get()
  @Roles(RESPONSABLE, ADMIN) // deja ADMIN para probar; luego puedes quitarlo
  async getMisFases(@Req() req: Request) {
    const anyReq = req as any;
    const u = anyReq?.user ?? {};
    let userId: number | null =
      typeof u?.id_usuario === 'number'
        ? u.id_usuario
        : typeof u?.id === 'number'
          ? u.id
          : null;

    // Fallback: intenta por correo si no vino id en el token
    const email: string | null =
      typeof u?.correo === 'string'
        ? u.correo
        : typeof u?.email === 'string'
          ? u.email
          : null;

    return this.service.getMisFases({ userId, email });
  }

  @Post(':id/approve')
  @Roles(RESPONSABLE, ADMIN)
  async approveFila(@Param('id') id: string, @Req() req: Request) {
    // el front te manda algo como "3-2" (area-nivel)
    const [areaStr, nivelStr] = id.split('-');
    const id_area = Number(areaStr);
    const id_nivel = Number(nivelStr);

    if (!id_area || !id_nivel) {
      throw new BadRequestException('ID de fila inválido.');
    }

    const user: any = (req as any).user;
    const actor_id = Number(user?.sub);

    return this.fases.closePhase({
      id_area,
      id_nivel,
      type: PhaseType.CLASIFICACION,
      actor_id,
    });
  }
}
