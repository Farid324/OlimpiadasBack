// src/interfaces/jwt-payload.interface.ts

export type RoleName = 'ADMINISTRADOR' | 'EVALUADOR' | 'RESPONSABLE_DE_AREA';

export interface JwtPayload {
  sub: string;
  email: string;
  role: RoleName;
  roleId?: string;
}
