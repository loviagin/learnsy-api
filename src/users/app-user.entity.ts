import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { UserSkill } from './user-skill.entity';

@Entity({ name: 'app_users' })
export class AppUser {
    @PrimaryGeneratedColumn('uuid') id: string;

    @Column({ type: 'uuid', unique: true })
    auth_user_id: string;

    @Column({ type: 'text', nullable: true })
    email_snapshot?: string;

    @Column({ type: 'text', nullable: true })
    name?: string;

    @Column({ type: 'text', nullable: true, unique: true })
    username?: string;

    @Column({ type: 'date', nullable: true })
    birth_date?: Date;

    @Column({ type: 'text', nullable: true })
    avatar_url?: string;

    @Column({ type: 'text', nullable: true })
    bio?: string;

    // Текущее состояние подписки пользователя (кэш для быстрых ответов API)
    @Column({ type: 'jsonb', nullable: true })
    subscription_json?: {
        plan?: string;
        status?: 'none' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'grace';
        startedAt?: string; // ISO8601
        currentPeriodEnd?: string; // ISO8601
        cancelAtPeriodEnd?: boolean;
        trialEndsAt?: string | null; // ISO8601
        autoRenew?: boolean;
        source?: 'appstore' | 'stripe' | 'promo' | 'internal';
        entitlements?: string[];
        meta?: Record<string, unknown>;
    } | null;

    @Column({ type: 'text', array: true, default: () => "'{}'" })
    roles: string[];

    @Column({ type: 'integer', default: 0 })
    subscribers_count: number;

    @Column({ type: 'integer', default: 0 })
    subscriptions_count: number;

    @OneToMany(() => UserSkill, userSkill => userSkill.user)
    skills: UserSkill[];

    @Column({ type: 'timestamptz', nullable: true })
    last_login_at?: Date;

    @Column({ type: 'timestamptz', default: () => 'now()' })
    created_at: Date;

    @Column({ type: 'timestamptz', default: () => 'now()' })
    updated_at: Date;
}