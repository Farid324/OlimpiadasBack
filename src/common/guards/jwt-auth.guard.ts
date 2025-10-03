// src/common/guards/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport'; // instalar pnpm install @nestjs/passport passport
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
