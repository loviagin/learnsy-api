import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtUser } from './jwt.guard';

export const ReqUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): JwtUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);