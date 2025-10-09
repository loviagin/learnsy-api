import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { DeepPartial } from 'typeorm';
import { AppUser } from '../users/app-user.entity';
import { Skill } from '../users/skill.entity';
import { UserSkill, SkillType } from '../users/user-skill.entity';
import { UserSubscription } from '../users/user-subscription.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(AppUser) private repo: Repository<AppUser>,
    @InjectRepository(Skill) private skillRepo: Repository<Skill>,
    @InjectRepository(UserSkill) private userSkillRepo: Repository<UserSkill>,
    @InjectRepository(UserSubscription) private userSubRepo: Repository<UserSubscription>,
  ) {}

  // Users
  async getAllUsers(): Promise<any[]> {
    const users = await this.repo.find({
      relations: ['skills', 'skills.skill'],
      order: { created_at: 'DESC' }
    });

    return users.map((user) => {
      const ownedSkills = user.skills
        ?.filter(us => us.type === SkillType.OWNED)
        .map(us => ({
          skill: {
            id: us.skill.id,
            name: us.skill.name,
            category: us.skill.category,
            icon_name: us.skill.icon_name,
          },
          level: us.level,
        })) || [];

      const desiredSkills = user.skills
        ?.filter(us => us.type === SkillType.DESIRED)
        .map(us => ({
          skill: {
            id: us.skill.id,
            name: us.skill.name,
            category: us.skill.category,
            icon_name: us.skill.icon_name,
          },
          level: null,
        })) || [];

      return {
        ...user,
        owned_skills: ownedSkills,
        desired_skills: desiredSkills,
        subscription: user.subscription_json ?? null,
      };
    });
  }

  async getUsersCount(): Promise<{ count: number }> {
    const count = await this.repo.count();
    return { count };
  }

  async createUser(params: {
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
  }): Promise<AppUser> {
    const { name, username, email, avatarUrl, bio, birthDate, authUserId, subscribersCount, subscriptionsCount, ownedSkills, desiredSkills } = params;

    // Проверяем уникальность username если он передан
    if (username) {
      const existing = await this.repo.findOne({ where: { username } });
      if (existing) {
        throw new Error('Username already exists');
      }
    }

    // Создаем пользователя
    const user = this.repo.create({
      auth_user_id: authUserId || 'admin-created',
      name: name || null,
      username: username || null,
      email_snapshot: email || null,
      avatar_url: avatarUrl || null,
      bio: bio || null,
      birth_date: birthDate ? new Date(birthDate) : null,
      subscribers_count: subscribersCount || 0,
      subscriptions_count: subscriptionsCount || 0,
    } as DeepPartial<AppUser>);

    const savedUser = await this.repo.save(user);

    // Добавляем навыки если они переданы
    if (ownedSkills || desiredSkills) {
      await this.updateUserSkillsInternal(savedUser.id, ownedSkills, desiredSkills);
    }

    return savedUser;
  }

  async deleteUser(id: string): Promise<AppUser> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) {
      throw new Error('User not found');
    }

    // Удаляем связанные навыки
    await this.userSkillRepo.delete({ user_id: id });

    // Удаляем пользователя
    await this.repo.remove(user);
    
    return user;
  }

  async updateUser(id: string, body: {
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
  }) {
    const user = await this.repo.findOne({ where: { id }, relations: ['skills', 'skills.skill'] });
    if (!user) throw new Error('User not found');

    const patch: QueryDeepPartialEntity<AppUser> = {} as any;
    if (body.name !== undefined) patch.name = body.name ?? null as any;
    if (body.username !== undefined) patch.username = body.username ?? null as any;
    if (body.email !== undefined) patch.email_snapshot = body.email ?? null as any;
    if (body.avatarUrl !== undefined) patch.avatar_url = body.avatarUrl ?? null as any;
    if (body.bio !== undefined) patch.bio = body.bio ?? null as any;
    if (body.birthDate !== undefined) patch.birth_date = body.birthDate ? new Date(body.birthDate) : null as any;
    if (body.roles !== undefined) patch.roles = body.roles as any;
    if (body.subscription !== undefined) (patch as any).subscription_json = body.subscription as any;
    if (body.subscribersCount !== undefined) (patch as any).subscribers_count = body.subscribersCount as any;
    if (body.subscriptionsCount !== undefined) (patch as any).subscriptions_count = body.subscriptionsCount as any;
    (patch as any).updated_at = new Date();

    if (Object.keys(patch).length > 0) {
      await this.repo.update({ id }, patch);
    }

    if (body.ownedSkills !== undefined || body.desiredSkills !== undefined) {
      await this.updateUserSkillsInternal(id, body.ownedSkills, body.desiredSkills);
    }

    const updated = await this.repo.findOne({ where: { id }, relations: ['skills', 'skills.skill'] });
    if (!updated) throw new Error('User not found after update');

    const ownedSkills = updated.skills
      ?.filter(us => us.type === SkillType.OWNED)
      .map(us => ({
        skill: {
          id: us.skill.id,
          name: us.skill.name,
          category: us.skill.category,
          icon_name: us.skill.icon_name,
        },
        level: us.level,
      })) || [];

    const desiredSkills = updated.skills
      ?.filter(us => us.type === SkillType.DESIRED)
      .map(us => ({
        skill: {
          id: us.skill.id,
          name: us.skill.name,
          category: us.skill.category,
          icon_name: us.skill.icon_name,
        },
        level: null,
      })) || [];

    const { skills: _omit, subscription_json: _omitSub2, ...rest } = updated as any;
    return {
      ...rest,
      owned_skills: ownedSkills,
      desired_skills: desiredSkills,
      subscription: (updated as any).subscription_json ?? null,
    };
  }

  private async updateUserSkillsInternal(
    userId: string,
    ownedSkills?: Array<{ skillId: string; level: string }>,
    desiredSkills?: Array<{ skillId: string }>,
  ): Promise<void> {
    // Если переданы ownedSkills (даже пустой массив) — очищаем именно owned и при наличии добавляем новые
    if (ownedSkills !== undefined) {
      await this.userSkillRepo.delete({ user_id: userId, type: SkillType.OWNED });
      if (ownedSkills.length > 0) {
        // Сначала убедимся, что навыки существуют в базе
        await this.ensureSkillsExist(ownedSkills.map(s => s.skillId));

        const userSkills = ownedSkills.map(({ skillId, level }) =>
          this.userSkillRepo.create({
            user_id: userId,
            skill_id: skillId,
            type: SkillType.OWNED,
            level,
          })
        );
        await this.userSkillRepo.save(userSkills);
      }
    }

    // Если переданы desiredSkills (даже пустой массив) — очищаем именно desired и при наличии добавляем новые
    if (desiredSkills !== undefined) {
      await this.userSkillRepo.delete({ user_id: userId, type: SkillType.DESIRED });
      if (desiredSkills.length > 0) {
        // Убедимся, что навыки существуют в базе
        await this.ensureSkillsExist(desiredSkills.map(s => s.skillId));

        const userSkills = desiredSkills.map(({ skillId }) =>
          this.userSkillRepo.create({
            user_id: userId,
            skill_id: skillId,
            type: SkillType.DESIRED,
          })
        );
        await this.userSkillRepo.save(userSkills);
      }
    }
  }

  private async ensureSkillsExist(skillIds: string[]): Promise<void> {
    // Проверяем какие навыки уже существуют
    const existing = await this.skillRepo.find({
      where: skillIds.map(id => ({ id })),
    });
    const existingIds = new Set(existing.map(s => s.id));
    
    // Создаем недостающие навыки из предопределенного списка
    const predefinedSkills = this.getPredefinedSkills();
    const skillsToCreate = skillIds
      .filter(id => !existingIds.has(id))
      .map(id => {
        const predefined = predefinedSkills.find(s => s.id === id);
        if (!predefined) {
          throw new Error(`Unknown skill: ${id}`);
        }
        return this.skillRepo.create(predefined);
      });
    
    if (skillsToCreate.length > 0) {
      await this.skillRepo.save(skillsToCreate);
    }
  }

  private getPredefinedSkills() {
    return [
      // Languages
      { id: 'english', name: 'English', category: 'Languages', icon_name: 'globe' },
      { id: 'spanish', name: 'Spanish', category: 'Languages', icon_name: 'globe' },
      { id: 'french', name: 'French', category: 'Languages', icon_name: 'globe' },
      { id: 'german', name: 'German', category: 'Languages', icon_name: 'globe' },
      { id: 'chinese', name: 'Chinese', category: 'Languages', icon_name: 'globe' },
      { id: 'japanese', name: 'Japanese', category: 'Languages', icon_name: 'globe' },
      
      // Business
      { id: 'marketing', name: 'Marketing', category: 'Business', icon_name: 'megaphone.fill' },
      { id: 'sales', name: 'Sales', category: 'Business', icon_name: 'chart.line.uptrend.xyaxis' },
      { id: 'management', name: 'Management', category: 'Business', icon_name: 'person.3.fill' },
      { id: 'accounting', name: 'Accounting', category: 'Business', icon_name: 'dollarsign.circle.fill' },
      { id: 'leadership', name: 'Leadership', category: 'Business', icon_name: 'star.fill' },
      { id: 'negotiation', name: 'Negotiation', category: 'Business', icon_name: 'handshake.fill' },
      
      // Creative
      { id: 'photography', name: 'Photography', category: 'Creative', icon_name: 'camera.fill' },
      { id: 'videography', name: 'Videography', category: 'Creative', icon_name: 'video.fill' },
      { id: 'writing', name: 'Writing', category: 'Creative', icon_name: 'pencil' },
      { id: 'drawing', name: 'Drawing', category: 'Creative', icon_name: 'paintbrush.fill' },
      { id: 'music', name: 'Music', category: 'Creative', icon_name: 'music.note' },
      { id: 'singing', name: 'Singing', category: 'Creative', icon_name: 'mic.fill' },
      
      // Design
      { id: 'figma', name: 'Figma', category: 'Design', icon_name: 'paintpalette.fill' },
      { id: 'photoshop', name: 'Photoshop', category: 'Design', icon_name: 'photo.fill' },
      { id: 'illustrator', name: 'Illustrator', category: 'Design', icon_name: 'paintbrush.fill' },
      { id: 'uxui', name: 'UX/UI Design', category: 'Design', icon_name: 'slider.horizontal.3' },
      
      // Sports & Fitness
      { id: 'yoga', name: 'Yoga', category: 'Sports', icon_name: 'figure.mind.and.body' },
      { id: 'running', name: 'Running', category: 'Sports', icon_name: 'figure.run' },
      { id: 'swimming', name: 'Swimming', category: 'Sports', icon_name: 'figure.pool.swim' },
      { id: 'cycling', name: 'Cycling', category: 'Sports', icon_name: 'bicycle' },
      { id: 'gym', name: 'Gym Training', category: 'Sports', icon_name: 'dumbbell.fill' },
      
      // Cooking & Food
      { id: 'cooking', name: 'Cooking', category: 'Cooking', icon_name: 'frying.pan.fill' },
      { id: 'baking', name: 'Baking', category: 'Cooking', icon_name: 'birthday.cake.fill' },
      { id: 'barista', name: 'Barista Skills', category: 'Cooking', icon_name: 'cup.and.saucer.fill' },
      
      // IT & Programming
      { id: 'swift', name: 'Swift', category: 'Programming', icon_name: 'swift' },
      { id: 'python', name: 'Python', category: 'Programming', icon_name: 'chevron.left.forwardslash.chevron.right' },
      { id: 'javascript', name: 'JavaScript', category: 'Programming', icon_name: 'curlybraces' },
      { id: 'webdev', name: 'Web Development', category: 'Programming', icon_name: 'globe' },
      
      // Communication
      { id: 'public-speaking', name: 'Public Speaking', category: 'Communication', icon_name: 'person.wave.2.fill' },
      { id: 'presentation', name: 'Presentation', category: 'Communication', icon_name: 'rectangle.stack.fill' },
      { id: 'networking', name: 'Networking', category: 'Communication', icon_name: 'person.2.fill' },
    ];
  }
}
