// src/auth/user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtUser } from './jwt.guard';

export const ReqUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    const req = ctx.switchToHttp().getRequest();
    return (req as any).user as JwtUser;
  },
);