import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppUser } from '../users/app-user.entity';
import { Skill } from '../users/skill.entity';
import { UserSkill } from '../users/user-skill.entity';
import { UserSubscription } from '../users/user-subscription.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AppUser, Skill, UserSkill, UserSubscription])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
