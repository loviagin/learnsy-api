// src/users/users.controller.ts
import { Controller, Get, Post, Put, Body, UseGuards, UseInterceptors, UploadedFile, BadRequestException, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ReqUser } from '../auth/user.decorator';
import { JwtGuard, type JwtUser } from '../auth/jwt.guard';
import { UsersService } from './users.service';

@Controller()
@UseGuards(JwtGuard)
export class UsersController {
  constructor(private readonly users: UsersService) { }

  @Get('me')
  async me(@ReqUser() user: JwtUser) {
    return this.users.getMeBySub(user.sub);
  }

  @Get('me/peek')
  async peek(@ReqUser() user: JwtUser) {
    const profile = await this.users.getMeBySub(user.sub);
    // Если профиль существует, возвращаем exists: true, profile: null
    // Если не существует, возвращаем exists: false, profile: draft из OIDC
    if (profile) {
      return { exists: true, profile: null };
    } else {
      return { 
        exists: false, 
        profile: {
          sub: user.sub,
          email: user.email ?? null,
          name: user.name ?? null,
          avatarUrl: null
        }
      };
    }
  }

  @Post('me/bootstrap')
  async bootstrap(
    @ReqUser() user: JwtUser,
    @Body() body: { 
      name?: string; 
      username?: string;
      email?: string; 
      avatarUrl?: string;
      bio?: string;
      birthDate?: string;
      ownedSkills?: Array<{ skillId: string; level: string }>;
      desiredSkills?: Array<{ skillId: string }>;
    }
  ) {
    const ensured = await this.users.ensureBySub({
      sub: user.sub, 
      email: body.email ?? user.email ?? null, 
      name: body.name ?? user.name ?? null,
      username: body.username ?? null,
      avatarUrl: body.avatarUrl ?? null,
      bio: body.bio ?? null,
      birthDate: body.birthDate ?? null,
      ownedSkills: body.ownedSkills,
      desiredSkills: body.desiredSkills,
    });
    return ensured;
  }

  @Put('me/skills')
  async updateSkills(
    @ReqUser() user: JwtUser,
    @Body() body: { 
      ownedSkills?: Array<{ skillId: string; level: string }>;
      desiredSkills?: Array<{ skillId: string }>;
    }
  ) {
    return this.users.updateUserSkills(user.sub, body.ownedSkills, body.desiredSkills);
  }

  @Put('me')
  async update(@ReqUser() user: JwtUser, @Body() body: { name?: string; avatar_url?: string }) {
    return this.users.updateMe(user.sub, body);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('avatar', {
    storage: diskStorage({
      destination: './uploads/avatars',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = extname(file.originalname);
        cb(null, `avatar-${uniqueSuffix}${ext}`);
      },
    }),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
        return cb(new BadRequestException('Only image files are allowed!'), false);
      }
      cb(null, true);
    },
  }))
  async uploadAvatar(
    @ReqUser() user: JwtUser,
    @UploadedFile() file: any
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    
    // Формируем URL для доступа к файлу
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    
    return { url: avatarUrl };
  }

  @Get('me/username-available')
  async usernameAvailable(@Query('username') username: string) {
    if (!username || username.length < 3) {
      return { available: false, reason: 'too_short' };
    }
    const available = await this.users.isUsernameAvailable(username);
    return { available };
  }

  // GET /v1/users/top?owned=swift,python&desired=english&limit=20
  @Get('users/top')
  async topUsers(
    @Query('owned') owned?: string,
    @Query('desired') desired?: string,
    @Query('limit') limit?: string,
  ) {
    const ownedSkillIds = owned ? owned.split(',').map(s => s.trim()).filter(Boolean) : undefined;
    const desiredSkillIds = desired ? desired.split(',').map(s => s.trim()).filter(Boolean) : undefined;
    const lim = limit ? Math.min(Math.max(parseInt(limit, 10) || 0, 1), 50) : 20;
    return this.users.getTopUsers({ ownedSkillIds, desiredSkillIds, limit: lim });
  }

}