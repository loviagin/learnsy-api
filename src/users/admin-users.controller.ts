import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: UsersService) { }

  @Get('all')
  async getAllUsers() {
    return this.users.getAllUsersAdmin();
  }

  @Get('count')
  async getUsersCount() {
    const count = await this.users.getUsersCount();
    return { count };
  }

  @Post('create')
  async createUser(@Body() body: {
    name?: string;
    username?: string;
    email?: string;
    avatarUrl?: string;
    bio?: string;
    birthDate?: string;
    authUserId?: string;
    ownedSkills?: Array<{ skillId: string; level: string }>;
    desiredSkills?: Array<{ skillId: string }>;
  }) {
    return this.users.createUser(body);
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    const deletedUser = await this.users.deleteUser(id);
    return {
      message: 'User deleted successfully',
      deletedUser: {
        id: deletedUser.id,
        name: deletedUser.name,
        username: deletedUser.username,
        email: deletedUser.email_snapshot
      }
    };
  }
}
