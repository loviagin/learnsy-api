// src/users/users.controller.ts
import { Controller, Get, Post, Put, Body, UseGuards } from '@nestjs/common';
import { ReqUser } from '../auth/user.decorator';
import { JwtGuard, type JwtUser } from '../auth/jwt.guard';
import { UsersService } from './users.service';

@Controller('me')
@UseGuards(JwtGuard)
export class UsersController {
  constructor(private readonly users: UsersService) { }

  @Get()
  async me(@ReqUser() user: JwtUser) {
    return this.users.getMeBySub(user.sub);
  }

  @Get('peek')
  async peek(@ReqUser() user: JwtUser) {
    const profile = await this.users.getMeBySub(user.sub);
    return { exists: !!profile, profile };
  }

  @Post('bootstrap')
  async bootstrap(@ReqUser() user: JwtUser) {
    const ensured = await this.users.ensureBySub({
      sub: user.sub, email: user.email ?? null, name: user.name ?? null, avatarUrl: null,
    });
    return ensured;
  }

  @Put()
  async update(@ReqUser() user: JwtUser, @Body() body: { name?: string; avatar_url?: string }) {
    return this.users.updateMe(user.sub, body);
  }
}