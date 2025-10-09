import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, CreateDateColumn, Unique, JoinColumn } from 'typeorm';
import { AppUser } from './app-user.entity';

@Entity({ name: 'user_follows' })
@Unique(['follower_id', 'following_id'])
export class UserFollow {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    follower_id: string;

    @Column({ type: 'uuid' })
    following_id: string;

    @ManyToOne(() => AppUser, { eager: true })
    @JoinColumn({ name: 'follower_id' })
    follower: AppUser;

    @ManyToOne(() => AppUser, { eager: true })
    @JoinColumn({ name: 'following_id' })
    following: AppUser;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;
}
