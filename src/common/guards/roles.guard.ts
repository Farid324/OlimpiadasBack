// src/common/guards/roles.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = req.user as { role?: string };

    if (!user?.role) {
      throw new ForbiddenException('No se pudo determinar el rol del usuario.');
    }

    const ok = required.includes(user.role);
    if (!ok) {
      throw new ForbiddenException(
        `Acceso denegado. Requiere un: ${required.join(', ')}`,
      );
    }
    return true;
  }
}
