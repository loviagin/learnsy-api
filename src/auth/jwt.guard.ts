// src/auth/jwt.guard.ts
import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { jwtVerify, createRemoteJWKSet } from 'jose';

const ISSUER = 'https://auth.lovig.in/api/oidc';
const AUDIENCE = 'https://la.nqstx.online';
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));

export type JwtUser = { sub: string; email?: string; name?: string };

@Injectable()
export class JwtGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const hdr = req.headers['authorization'] as string | undefined;
    if (!hdr?.startsWith('Bearer ')) throw new UnauthorizedException('missing bearer');

    const token = hdr.slice(7);
    
    // DEBUG: логируем формат токена
    const parts = token.split('.');
    console.log('[JWT] Token format check:', {
      length: token.length,
      parts: parts.length,
      prefix: token.substring(0, 20),
    });
    
    if (parts.length !== 3) {
      console.error('[JWT] Invalid token format - expected 3 parts (header.payload.signature), got:', parts.length);
      throw new UnauthorizedException('invalid token format');
    }
    
    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ['ES256'],
      });
      // положим user в req
      (req as any).user = {
        sub: String(payload.sub),
        email: payload.email as string | undefined,
        name: payload.name as string | undefined,
      } satisfies JwtUser;
      return true;
    } catch (e) {
      console.error('[JWT] verify failed:', e);
      throw new UnauthorizedException('invalid token');
    }
  }
}