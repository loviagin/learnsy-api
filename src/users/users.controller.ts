// src/users/users.controller.ts
import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtGuard } from '../auth/jwt.guard';
import type { JwtUser } from '../auth/jwt.guard';
import { ReqUser } from '../auth/user.decorator';

@Controller('/v1/me')
@UseGuards(JwtGuard)
export class UsersController {
  constructor(private readonly users: UsersService) { }

  @Get()
  async me(@ReqUser() user: JwtUser) {
    const me = await this.users.getMeBySub(user.sub);
    return { ok: true, me };
  }

  @Get('peek')
  async peek(@ReqUser() user: JwtUser) {
    const me = await this.users.getMeBySub(user.sub);
    return { exists: !!me, profile: { email: user.email ?? null, name: user.name ?? null, avatarUrl: null } };
  }

  @Post('bootstrap')
  async bootstrap(@ReqUser() user: JwtUser) {
    const me = await this.users.ensureBySub({
      sub: user.sub,
      email: user.email ?? null,
      name: user.name ?? null,
      avatarUrl: null,
    });
    return { ok: true, me };
  }

  @Put()
  async update(@ReqUser() user: JwtUser, @Body() body: { name?: string; avatar_url?: string }) {
    const me = await this.users.updateMe(user.sub, { name: body.name, avatar_url: body.avatar_url });
    return { ok: true, me };
  }
}