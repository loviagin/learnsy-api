// src/auth/jwt.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

export type JwtUser = {
  sub: string;
  email?: string | null;
  name?: string | null;
};

const ISSUER = process.env.OIDC_ISSUER ?? 'https://auth.lovig.in/api/oidc';
const JWKS_URI = `${ISSUER}/.well-known/jwks.json`;
const EXPECTED_AUD = process.env.OIDC_AUDIENCE || '';

const JWKS = createRemoteJWKSet(new URL(JWKS_URI));

@Injectable()
export class JwtGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers['authorization'] as string | undefined;
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('missing bearer');

    const token = auth.slice('Bearer '.length).trim();

    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: ISSUER,
        // временно без жесткой проверки аудитории:
        // audience: EXPECTED_AUD || undefined,
      });

      // мягкая проверка aud
      if (EXPECTED_AUD) {
        const aud = (payload.aud && (Array.isArray(payload.aud) ? payload.aud : [payload.aud])) || [];
        if (!aud.includes(EXPECTED_AUD)) {
          console.warn('[JWT] unexpected aud:', aud, 'expected:', EXPECTED_AUD);
        }
      }

      (req as any).user = {
        sub: payload.sub!,
        email: (payload as JWTPayload & { email?: string }).email ?? null,
        name: (payload as JWTPayload & { name?: string }).name ?? null,
      } as JwtUser;

      return true;
    } catch (e) {
      console.error('[JWT] verify failed:', e);
      throw new UnauthorizedException('invalid token');
    }
  }
}