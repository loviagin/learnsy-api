import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppUser } from './app-user.entity';
import { Skill } from './skill.entity';
import { UserSkill } from './user-skill.entity';
import { UserSubscription } from './user-subscription.entity';
import { UserFollow } from './user-follow.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AppUser, Skill, UserSkill, UserSubscription, UserFollow])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService]
})
export class UsersModule {}
