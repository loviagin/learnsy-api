// src/auth/jwt.guard.ts
import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';

const ISSUER = 'https://auth.lovig.in/api/oidc';
const USERINFO_URL = `${ISSUER}/me`;

export type JwtUser = { sub: string; email?: string; name?: string };

@Injectable()
export class JwtGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const hdr = req.headers['authorization'] as string | undefined;
    if (!hdr?.startsWith('Bearer ')) throw new UnauthorizedException('missing bearer');

    const token = hdr.slice(7);
    
    // Используем userinfo endpoint для валидации opaque токенов
    try {
      const response = await fetch(USERINFO_URL, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        console.error('[Auth] UserInfo failed:', response.status, response.statusText);
        throw new UnauthorizedException('invalid token');
      }
      
      const userInfo = await response.json() as { sub: string; email?: string; name?: string };
      
      // Положим user в req
      (req as any).user = {
        sub: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name,
      } satisfies JwtUser;
      
      return true;
    } catch (e) {
      console.error('[Auth] validation failed:', e);
      throw new UnauthorizedException('invalid token');
    }
  }
}