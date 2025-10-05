import { Controller, Get, Put, Body, UseGuards, Post } from '@nestjs/common';
import * as jwtGuard from '../auth/jwt.guard';
import { ReqUser } from '../auth/user.decorator';
import { UsersService } from './users.service';

@UseGuards(jwtGuard.JwtAuthGuard)
@Controller('me')
export class UsersController {
  constructor(private users: UsersService) { }

  @Get()
  async me(@ReqUser() user: jwtGuard.JwtUser) {
    const u = await this.users.ensureBySub({
      sub: user.sub,
      email: (user as any).email,
      name: (user as any).name,
      avatarUrl: (user as any).picture,
    });
    return u;
  }

  @Get('peek')
  async peek(@ReqUser() user: { sub: string; email?: string; name?: string; picture?: string }) {
    const exists = await this.users.existsBySub(user.sub);
    return {
      exists,
      profile: {
        email: user.email ?? null,
        name: user.name ?? null,
        avatarUrl: user.picture ?? null,
      },
    };
  }

  // Новое: bootstrap (создаёт по явной команде)
  @Post('bootstrap')
  async bootstrap(
    @ReqUser() user: { sub: string },
    @Body() body: { name?: string; email?: string; avatarUrl?: string },
  ) {
    return this.users.bootstrap({
      sub: user.sub,
      email: body.email ?? null,
      name: body.name ?? null,
      avatarUrl: body.avatarUrl ?? null,
    });
  }

  @Put()
  async update(@ReqUser() user: jwtGuard.JwtUser, @Body() body: { name?: string; avatar_url?: string }) {
    return this.users.updateMe(user.sub, body);
  }
}