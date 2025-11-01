import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ControlFasesRespService } from './controlFasesResp.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('control-fases/responsables')
export class ControlFasesRespController {
  constructor(private readonly service: ControlFasesRespService) {}

  @Get()
  @Roles('RESPONSABLE_DE_AREA', 'ADMINISTRADOR') // deja ADMIN para probar; luego puedes quitarlo
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
}
