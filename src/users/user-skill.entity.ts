import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AppUser } from './app-user.entity';
import { Skill } from './skill.entity';

export enum SkillType {
    OWNED = 'owned',
    DESIRED = 'desired',
}

@Entity({ name: 'user_skills' })
export class UserSkill {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    user_id: string;

    @ManyToOne(() => AppUser, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: AppUser;

    @Column({ type: 'text' })
    skill_id: string;

    @ManyToOne(() => Skill, { eager: true })
    @JoinColumn({ name: 'skill_id' })
    skill: Skill;

    @Column({ type: 'text' })
    type: SkillType; // 'owned' or 'desired'

    @Column({ type: 'text', nullable: true })
    level?: string; // только для owned: 'Beginner', 'Intermediate', 'Advanced', 'Expert'

    @Column({ type: 'timestamptz', default: () => 'now()' })
    created_at: Date;
}

