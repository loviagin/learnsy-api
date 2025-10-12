import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, JoinColumn } from 'typeorm';
import { AppUser } from '../users/app-user.entity';

@Entity({ name: 'device_tokens' })
export class DeviceToken {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    user_id: string;

    @Column({ type: 'text' })
    token: string;

    @Column({ type: 'text', default: 'ios' })
    platform: string;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @Column({ type: 'timestamptz', default: () => 'now()' })
    created_at: Date;

    @Column({ type: 'timestamptz', default: () => 'now()' })
    updated_at: Date;

    @ManyToOne(() => AppUser, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: AppUser;
}
