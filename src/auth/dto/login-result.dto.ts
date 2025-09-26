// src/auth/dto/login-result.dto.ts
export type RoleName = 'ADMINISTRADOR' | 'EVALUADOR' | 'RESPONSABLE_DE_AREA';

export interface LoginResult {
  access_token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: RoleName;
  };
}
