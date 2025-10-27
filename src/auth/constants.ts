// src/auth/constants.ts
export const ADMIN = 'ADMINISTRADOR';
export const EVALUADOR = 'EVALUADOR';
export const RESPONSABLE = 'RESPONSABLE_DE_AREA';


export const jwtConstants = {
  secret: process.env.JWT_SECRET || 'dev-secret',
  expiresIn: '2h',
};