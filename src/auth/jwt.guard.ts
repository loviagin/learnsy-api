// src/auth/jwt.guard.ts
import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

type JWKSFn = ReturnType<typeof createRemoteJWKSet>;
export type JwtUser = JWTPayload & { sub: string; scope?: string };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private issuer: string;
  private audience: string;
  private jwksUri: string;
  private jwks: JWKSFn | null = null;

  constructor(private readonly cfg: ConfigService) {
    // читаем env уже после инициализации ConfigModule
    this.issuer   = this.must('OIDC_ISSUER');
    this.audience = this.must('OIDC_AUDIENCE', 'skillify-api'); // дефолт если хочешь
    this.jwksUri  = this.must('OIDC_JWKS_URI');
  }

  private must(key: string, def?: string) {
    const v = this.cfg.get<string>(key) ?? def;
    if (!v) throw new Error(`Missing env ${key}`);
    return v;
  }

  private getJWKS(): JWKSFn {
    if (!this.jwks) {
      this.jwks = createRemoteJWKSet(new URL(this.jwksUri));
    }
    return this.jwks!;
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<any>();
    const auth = req.headers['authorization'] as string | undefined;
    const m = auth?.match(/^Bearer\s+(.+)$/i);
    if (!m) throw new UnauthorizedException('missing_bearer');

    try {
      const { payload } = await jwtVerify(m[1], this.getJWKS(), {
        issuer: this.issuer,
        audience: this.audience,
      });
      if (!payload.sub) throw new UnauthorizedException('no_sub');
      req.user = payload as JwtUser;
      return true;
    } catch {
      throw new UnauthorizedException('invalid_token');
    }
  }
}