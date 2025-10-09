import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity({ name: 'user_subscriptions' })
export class UserSubscription {
    @PrimaryGeneratedColumn('uuid') id: string;

    @Index()
    @Column('uuid') user_id: string;

    @Column({ type: 'text' }) plan: string; // e.g., pro_monthly
    @Column({ type: 'text' }) status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'grace';

    @Column({ type: 'timestamptz', nullable: true }) period_start?: Date | null;
    @Column({ type: 'timestamptz', nullable: true }) period_end?: Date | null;
    @Column({ type: 'timestamptz', nullable: true }) trial_end?: Date | null;

    @Column({ type: 'bool', default: true }) auto_renew: boolean;
    @Column({ type: 'bool', default: false }) cancel_at_period_end: boolean;

    @Column({ type: 'text', nullable: true }) source?: 'appstore' | 'stripe' | 'promo' | 'internal' | null;

    @Column({ type: 'jsonb', nullable: true }) entitlements?: string[] | null;
    @Column({ type: 'jsonb', nullable: true }) meta?: Record<string, unknown> | null;

    @Column({ type: 'timestamptz', default: () => 'now()' }) created_at: Date;
}


