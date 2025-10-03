// src/interfaces/jwt-payload.interface.ts
export interface JwtPayload {
  sub: string; // id_usuario stringificado
  email: string;
  roleId: string;
  roleName: 'ADMINISTRADOR' | 'EVALUADOR' | 'RESPONSABLE_DE_AREA';
}
