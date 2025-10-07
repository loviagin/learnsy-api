import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AdminUsersController } from './admin-users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppUser } from './app-user.entity';
import { Skill } from './skill.entity';
import { UserSkill } from './user-skill.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AppUser, Skill, UserSkill])],
  controllers: [UsersController, AdminUsersController],
  providers: [UsersService],
  exports: [UsersService]
})
export class UsersModule {}
