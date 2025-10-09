import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Users management
  @Get('users/all')
  async getAllUsers() {
    return this.adminService.getAllUsers();
  }

  @Get('users/count')
  async getUsersCount() {
    return this.adminService.getUsersCount();
  }

  @Post('users/create')
  async createUser(@Body() body: {
    name?: string;
    username?: string;
    email?: string;
    avatarUrl?: string;
    bio?: string;
    birthDate?: string;
    authUserId?: string;
    subscribersCount?: number;
    subscriptionsCount?: number;
    ownedSkills?: Array<{ skillId: string; level: string }>;
    desiredSkills?: Array<{ skillId: string }>;
  }) {
    return this.adminService.createUser(body);
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @Put('users/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      username?: string;
      email?: string;
      avatarUrl?: string;
      bio?: string;
      birthDate?: string;
      roles?: string[];
      subscription?: any;
      subscribersCount?: number;
      subscriptionsCount?: number;
      ownedSkills?: Array<{ skillId: string; level: string }>;
      desiredSkills?: Array<{ skillId: string }>;
    }
  ) {
    return this.adminService.updateUser(id, body);
  }
}
