import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'app_users' })
export class AppUser {
    @PrimaryGeneratedColumn('uuid') id: string;

    @Column({ type: 'uuid', unique: true })
    auth_user_id: string;

    @Column({ type: 'text', nullable: true })
    email_snapshot?: string;

    @Column({ type: 'text', nullable: true })
    name?: string;

    @Column({ type: 'text', nullable: true })
    avatar_url?: string;

    @Column({ type: 'text', array: true, default: () => "'{}'" })
    roles: string[];

    @Column({ type: 'timestamptz', nullable: true })
    last_login_at?: Date;

    @Column({ type: 'timestamptz', default: () => 'now()' })
    created_at: Date;

    @Column({ type: 'timestamptz', default: () => 'now()' })
    updated_at: Date;
}