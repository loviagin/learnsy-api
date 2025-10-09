import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { DeepPartial } from 'typeorm';
import { AppUser } from './app-user.entity';
import { Skill } from './skill.entity';
import { UserSkill, SkillType } from './user-skill.entity';
import { UserSubscription } from './user-subscription.entity';
import { UserFollow } from './user-follow.entity';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(AppUser) private repo: Repository<AppUser>,
        @InjectRepository(Skill) private skillRepo: Repository<Skill>,
        @InjectRepository(UserSkill) private userSkillRepo: Repository<UserSkill>,
        @InjectRepository(UserSubscription) private userSubRepo: Repository<UserSubscription>,
        @InjectRepository(UserFollow) private userFollowRepo: Repository<UserFollow>,
    ) { }

    async ensureBySub(params: {
        sub: string;
        email?: string | null;
        name?: string | null;
        username?: string | null;
        avatarUrl?: string | null;
        bio?: string | null;
        birthDate?: string | null;
        ownedSkills?: Array<{ skillId: string; level: string }>;
        desiredSkills?: Array<{ skillId: string }>;
    }): Promise<AppUser> {
        const { sub, email, name, username, avatarUrl, bio, birthDate, ownedSkills, desiredSkills } = params;
        const existing = await this.repo.findOne({ where: { auth_user_id: sub } });
        if (existing) {
            existing.last_login_at = new Date();
            if (existing.name == null && name) existing.name = name;
            if (existing.email_snapshot == null && email) existing.email_snapshot = email;
            if (existing.username == null && username) existing.username = username;
            if (existing.avatar_url == null && avatarUrl) existing.avatar_url = avatarUrl;
            if (existing.bio == null && bio) existing.bio = bio;
            if (existing.birth_date == null && birthDate) existing.birth_date = new Date(birthDate);
            existing.updated_at = new Date();
            
            // Обновляем навыки, если они переданы
            if (ownedSkills || desiredSkills) {
                await this.updateUserSkillsInternal(existing.id, ownedSkills, desiredSkills);
            }
            
            return this.repo.save(existing);
        }
        const created = this.repo.create({
            auth_user_id: sub,
            name: name ?? null,
            username: username ?? null,
            email_snapshot: email ?? null,
            avatar_url: avatarUrl ?? null,
            bio: bio ?? null,
            birth_date: birthDate ? new Date(birthDate) : null,
            last_login_at: new Date(),
        } as DeepPartial<AppUser>);

        const saved = await this.repo.save(created);
        
        // Добавляем навыки для нового пользователя
        if (ownedSkills || desiredSkills) {
            await this.updateUserSkillsInternal(saved.id, ownedSkills, desiredSkills);
        }
        
        return saved;
    }

    async getMeBySub(sub: string) {
        const user = await this.repo.findOne({ 
            where: { auth_user_id: sub },
            relations: ['skills', 'skills.skill']
        });
        
        if (user) {
            // Прочитаем текущее состояние подписки из кэша (subscription_json)
            const subscription = user.subscription_json ?? null;
            // Преобразуем навыки в удобный формат для клиента
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
            
            const { skills: _omitSkills, subscription_json: _omitSub, ...rest } = user as any;
            return {
                ...rest,
                owned_skills: ownedSkills,
                desired_skills: desiredSkills,
                subscription: subscription,
            };
        }
        
        return null;
    }

    async updateMe(sub: string, patch: Partial<Pick<AppUser, 'name' | 'avatar_url'>>) {
        await this.repo.update({ auth_user_id: sub }, { ...patch, updated_at: new Date() });
        return this.getMeBySub(sub);
    }

    async existsBySub(sub: string): Promise<boolean> {
        const cnt = await this.repo.count({ where: { auth_user_id: sub } });
        return cnt > 0;
    }

    async isUsernameAvailable(username: string): Promise<boolean> {
        if (!username) return false;
        const exists = await this.repo.exist({ where: { username } });
        return !exists;
    }

    async bootstrap(params: {
        sub: string;
        email?: string | null;
        name?: string | null;
        avatarUrl?: string | null;
    }): Promise<AppUser> {
        const { sub, email, name, avatarUrl } = params;
        const existing = await this.repo.findOne({ where: { auth_user_id: sub } });
        if (existing) return existing;

        const created = this.repo.create({
            auth_user_id: sub,
            name: name ?? null,
            email_snapshot: email ?? null,
            avatar_url: avatarUrl ?? null,
            last_login_at: new Date(),
        } as DeepPartial<AppUser>);
        return this.repo.save(created);
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
            { id: 'management', name: 'Management', category: 'Business', icon_name: 'person.2.fill' },
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
            { id: 'public_speaking', name: 'Public Speaking', category: 'Communication', icon_name: 'person.wave.2.fill' },
            { id: 'presentation', name: 'Presentations', category: 'Communication', icon_name: 'chart.bar.doc.horizontal.fill' },
            { id: 'storytelling', name: 'Storytelling', category: 'Communication', icon_name: 'text.bubble.fill' },
            
            // Music Instruments
            { id: 'guitar', name: 'Guitar', category: 'Music', icon_name: 'guitars.fill' },
            { id: 'piano', name: 'Piano', category: 'Music', icon_name: 'pianokeys' },
            { id: 'drums', name: 'Drums', category: 'Music', icon_name: 'music.note' },
            { id: 'violin', name: 'Violin', category: 'Music', icon_name: 'music.quarternote.3' },
            
            // Dance
            { id: 'ballet', name: 'Ballet', category: 'Dance', icon_name: 'figure.dance' },
            { id: 'salsa', name: 'Salsa', category: 'Dance', icon_name: 'figure.dance' },
            { id: 'hiphop', name: 'Hip-Hop', category: 'Dance', icon_name: 'figure.dance' },
            { id: 'contemporary', name: 'Contemporary', category: 'Dance', icon_name: 'figure.dance' },
            { id: 'dancing', name: 'Dancing', category: 'Dance', icon_name: 'figure.dance' },
            
            // Crafts & Handmade
            { id: 'sewing', name: 'Sewing', category: 'Crafts', icon_name: 'scissors' },
            { id: 'knitting', name: 'Knitting', category: 'Crafts', icon_name: 'scissors' },
            { id: 'woodworking', name: 'Woodworking', category: 'Crafts', icon_name: 'hammer.fill' },
            { id: 'pottery', name: 'Pottery', category: 'Crafts', icon_name: 'cube.fill' },
            { id: 'jewelry', name: 'Jewelry Making', category: 'Crafts', icon_name: 'sparkles' },
            
            // Professional Skills
            { id: 'project_management', name: 'Project Management', category: 'Professional', icon_name: 'calendar' },
            { id: 'time_management', name: 'Time Management', category: 'Professional', icon_name: 'clock.fill' },
            { id: 'teamwork', name: 'Teamwork', category: 'Professional', icon_name: 'person.2.fill' },
            { id: 'problem_solving', name: 'Problem Solving', category: 'Professional', icon_name: 'lightbulb.fill' },
            { id: 'critical_thinking', name: 'Critical Thinking', category: 'Professional', icon_name: 'brain.head.profile' },
            
            // Teaching & Education
            { id: 'teaching', name: 'Teaching', category: 'Education', icon_name: 'book.fill' },
            { id: 'tutoring', name: 'Tutoring', category: 'Education', icon_name: 'person.and.background.dotted' },
            { id: 'mentoring', name: 'Mentoring', category: 'Education', icon_name: 'person.2.badge.gearshape.fill' },
            
            // Technical (non-IT)
            { id: 'auto_repair', name: 'Auto Repair', category: 'Technical', icon_name: 'car.fill' },
            { id: 'electronics', name: 'Electronics', category: 'Technical', icon_name: 'powerplug.fill' },
            { id: 'plumbing', name: 'Plumbing', category: 'Technical', icon_name: 'wrench.adjustable.fill' },
            { id: 'carpentry', name: 'Carpentry', category: 'Technical', icon_name: 'hammer.fill' },
            
            // Health & Wellness
            { id: 'meditation', name: 'Meditation', category: 'Wellness', icon_name: 'brain.head.profile' },
            { id: 'nutrition', name: 'Nutrition', category: 'Wellness', icon_name: 'leaf.fill' },
            { id: 'massage', name: 'Massage Therapy', category: 'Wellness', icon_name: 'hand.raised.fill' },
            { id: 'personal_training', name: 'Personal Training', category: 'Wellness', icon_name: 'figure.run' },
            
            // Entertainment
            { id: 'acting', name: 'Acting', category: 'Entertainment', icon_name: 'theatermasks.fill' },
            { id: 'comedy', name: 'Comedy', category: 'Entertainment', icon_name: 'face.smiling.fill' },
            { id: 'magic', name: 'Magic Tricks', category: 'Entertainment', icon_name: 'wand.and.stars' },
            
            // Gaming & Esports
            { id: 'chess', name: 'Chess', category: 'Games', icon_name: 'square.grid.3x3.fill' },
            { id: 'poker', name: 'Poker', category: 'Games', icon_name: 'suit.club.fill' },
            { id: 'esports', name: 'Esports', category: 'Games', icon_name: 'gamecontroller.fill' },
            
            // Outdoor & Adventure
            { id: 'hiking', name: 'Hiking', category: 'Outdoor', icon_name: 'mountain.2.fill' },
            { id: 'camping', name: 'Camping', category: 'Outdoor', icon_name: 'tent.fill' },
            { id: 'fishing', name: 'Fishing', category: 'Outdoor', icon_name: 'fish.fill' },
            { id: 'climbing', name: 'Rock Climbing', category: 'Outdoor', icon_name: 'figure.climbing' },
            { id: 'surfing', name: 'Surfing', category: 'Outdoor', icon_name: 'water.waves' },
            { id: 'skiing', name: 'Skiing', category: 'Outdoor', icon_name: 'figure.skiing.downhill' },
            
            // Science & Research
            { id: 'data_analysis', name: 'Data Analysis', category: 'Science', icon_name: 'chart.bar.fill' },
            { id: 'research', name: 'Research', category: 'Science', icon_name: 'doc.text.magnifyingglass' },
            { id: 'lab_work', name: 'Laboratory Work', category: 'Science', icon_name: 'flask.fill' },
            
            // Social & Volunteer
            { id: 'volunteering', name: 'Volunteering', category: 'Social', icon_name: 'heart.fill' },
            { id: 'counseling', name: 'Counseling', category: 'Social', icon_name: 'bubble.left.and.bubble.right.fill' },
            { id: 'social_work', name: 'Social Work', category: 'Social', icon_name: 'person.2.fill' },
            
            // Other
            { id: 'driving', name: 'Driving', category: 'Other', icon_name: 'car.fill' },
            { id: 'gardening', name: 'Gardening', category: 'Other', icon_name: 'leaf.fill' },
            { id: 'diy', name: 'DIY & Repairs', category: 'Other', icon_name: 'hammer.fill' },
            { id: 'first_aid', name: 'First Aid', category: 'Other', icon_name: 'cross.case.fill' },
            { id: 'pet_care', name: 'Pet Care', category: 'Other', icon_name: 'pawprint.fill' },
            { id: 'babysitting', name: 'Babysitting', category: 'Other', icon_name: 'figure.2.and.child.holdinghands' },
        ];
    }

    async getAllUsers(excludeAuthUserId?: string): Promise<any[]> {
        const users = await this.repo.find({
            relations: ['skills', 'skills.skill'],
            order: { created_at: 'DESC' }
        });
        const filtered = excludeAuthUserId
            ? users.filter(u => u.auth_user_id !== excludeAuthUserId)
            : users;
        const mapped = filtered.map((user) => {
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

            const { skills: _omitSkills, subscription_json: _omitSub, ...rest } = user as any;
            return {
                ...rest,
                owned_skills: ownedSkills,
                desired_skills: desiredSkills,
                subscription: (user as any).subscription_json ?? null,
            };
        });

        // Hide users without avatar and without both skills sets
        return mapped.filter(u => {
            const hasAvatar = !!u.avatar_url && String(u.avatar_url).trim().length > 0;
            const hasOwned = Array.isArray(u.owned_skills) && u.owned_skills.length > 0;
            const hasDesired = Array.isArray(u.desired_skills) && u.desired_skills.length > 0;
            return hasAvatar && hasOwned && hasDesired;
        });
    }

    
    async updateUserSkills(
        authUserId: string,
        ownedSkills?: Array<{ skillId: string; level: string }>,
        desiredSkills?: Array<{ skillId: string }>
    ): Promise<AppUser> {
        const user = await this.repo.findOne({ where: { auth_user_id: authUserId } });
        if (!user) {
            throw new Error('User not found');
        }

        // Обновляем навыки пользователя
        await this.updateUserSkillsInternal(user.id, ownedSkills, desiredSkills);
        
        // Возвращаем обновленного пользователя
        const updatedUser = await this.getMeBySub(authUserId);
        if (!updatedUser) {
            throw new Error('Failed to fetch updated user');
        }
        return updatedUser;
    }

    // MARK: - Follow/Subscription Methods
    async followUser(followerAuthId: string, followingUserId: string): Promise<{ success: boolean; message: string }> {
        try {
            // Get follower user
            const follower = await this.repo.findOne({ where: { auth_user_id: followerAuthId } });
            if (!follower) {
                throw new Error('Follower not found');
            }

            // Get following user
            const following = await this.repo.findOne({ where: { id: followingUserId } });
            if (!following) {
                throw new Error('User to follow not found');
            }

            // Check if already following
            const existingFollow = await this.userFollowRepo.findOne({
                where: { follower_id: follower.id, following_id: following.id }
            });

            if (existingFollow) {
                return { success: false, message: 'Already following this user' };
            }

            // Create follow relationship
            const follow = this.userFollowRepo.create({
                follower_id: follower.id,
                following_id: following.id
            });

            await this.userFollowRepo.save(follow);

            // Update counters
            await this.repo.increment({ id: following.id }, 'subscribers_count', 1);
            await this.repo.increment({ id: follower.id }, 'subscriptions_count', 1);

            return { success: true, message: 'Successfully followed user' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async unfollowUser(followerAuthId: string, followingUserId: string): Promise<{ success: boolean; message: string }> {
        try {
            // Get follower user
            const follower = await this.repo.findOne({ where: { auth_user_id: followerAuthId } });
            if (!follower) {
                throw new Error('Follower not found');
            }

            // Get following user
            const following = await this.repo.findOne({ where: { id: followingUserId } });
            if (!following) {
                throw new Error('User to unfollow not found');
            }

            // Find and delete follow relationship
            const follow = await this.userFollowRepo.findOne({
                where: { follower_id: follower.id, following_id: following.id }
            });

            if (!follow) {
                return { success: false, message: 'Not following this user' };
            }

            await this.userFollowRepo.remove(follow);

            // Update counters
            await this.repo.decrement({ id: following.id }, 'subscribers_count', 1);
            await this.repo.decrement({ id: follower.id }, 'subscriptions_count', 1);

            return { success: true, message: 'Successfully unfollowed user' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async isFollowing(followerAuthId: string, followingUserId: string): Promise<{ isFollowing: boolean }> {
        try {
            const follower = await this.repo.findOne({ where: { auth_user_id: followerAuthId } });
            if (!follower) {
                return { isFollowing: false };
            }

            const follow = await this.userFollowRepo.findOne({
                where: { follower_id: follower.id, following_id: followingUserId }
            });

            return { isFollowing: !!follow };
        } catch (error) {
            return { isFollowing: false };
        }
    }

    async getUserSubscriptions(authUserId: string): Promise<AppUser[]> {
        try {
            const user = await this.repo.findOne({ where: { auth_user_id: authUserId } });
            if (!user) {
                return [];
            }

            const follows = await this.userFollowRepo.find({
                where: { follower_id: user.id },
                relations: ['following']
            });

            return follows.map(follow => follow.following);
        } catch (error) {
            return [];
        }
    }

    async getUserFollowers(authUserId: string): Promise<AppUser[]> {
        try {
            const user = await this.repo.findOne({ where: { auth_user_id: authUserId } });
            if (!user) {
                return [];
            }

            const follows = await this.userFollowRepo.find({
                where: { following_id: user.id },
                relations: ['follower']
            });

            return follows.map(follow => follow.follower);
        } catch (error) {
            return [];
        }
    }

    async getUserById(userId: string): Promise<any> {
        try {
            const user = await this.repo.findOne({
                where: { id: userId },
                relations: ['skills', 'skills.skill']
            });

            if (!user) {
                return null;
            }

            // Преобразуем данные в формат, ожидаемый iOS приложением
            const ownedSkills = user.skills?.filter(skill => skill.type === 'owned') || [];
            const desiredSkills = user.skills?.filter(skill => skill.type === 'desired') || [];

            return {
                ...user,
                owned_skills: ownedSkills,
                desired_skills: desiredSkills,
                skills: undefined // Убираем оригинальное поле
            };
        } catch (error) {
            console.error('Error fetching user by ID:', error);
            return null;
        }
    }

}