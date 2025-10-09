// src/users/users.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, UseInterceptors, UploadedFile, BadRequestException, Query } from '@nestjs/common';
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

  // List all users for the main screen
  @Get('users')
  async listUsers(@ReqUser() user: JwtUser) {
    return this.users.getAllUsers(user.sub);
  }

  // Follow/Unfollow user
  @Post('users/:userId/follow')
  async followUser(@ReqUser() user: JwtUser, @Param('userId') userId: string) {
    return this.users.followUser(user.sub, userId);
  }

  @Delete('users/:userId/follow')
  async unfollowUser(@ReqUser() user: JwtUser, @Param('userId') userId: string) {
    return this.users.unfollowUser(user.sub, userId);
  }

  // Get user's subscriptions
  @Get('me/subscriptions')
  async getMySubscriptions(@ReqUser() user: JwtUser) {
    return this.users.getUserSubscriptions(user.sub);
  }

  // Get user's followers
  @Get('me/followers')
  async getMyFollowers(@ReqUser() user: JwtUser) {
    return this.users.getUserFollowers(user.sub);
  }

  // Check if following user
  @Get('users/:userId/following')
  async isFollowing(@ReqUser() user: JwtUser, @Param('userId') userId: string) {
    return this.users.isFollowing(user.sub, userId);
  }

  // Get user profile by ID
  @Get('users/:userId')
  async getUserProfile(@Param('userId') userId: string) {
    return this.users.getUserById(userId);
  }

  // Get user's followers
  @Get('users/:userId/followers')
  async getUserFollowers(@Param('userId') userId: string) {
    return this.users.getUserFollowers(userId);
  }

  // Get user's subscriptions
  @Get('users/:userId/subscriptions')
  async getUserSubscriptions(@Param('userId') userId: string) {
    return this.users.getUserSubscriptions(userId);
  }
}