import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, JoinColumn } from 'typeorm';
import { AppUser } from '../users/app-user.entity';

@Entity({ name: 'chats' })
export class Chat {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'text', nullable: true })
    name?: string;

    @Column({ type: 'text', nullable: true })
    avatar_url?: string;

    @Column({ type: 'text', default: 'direct' })
    type: 'direct' | 'group';

    @Column({ type: 'timestamptz', default: () => 'now()' })
    created_at: Date;

    @Column({ type: 'timestamptz', default: () => 'now()' })
    updated_at: Date;

    @Column({ type: 'timestamptz', nullable: true })
    last_message_at?: Date;

    @Column({ type: 'text', nullable: true })
    last_message_text?: string;

    @Column({ type: 'uuid', nullable: true })
    last_message_user_id?: string;

    @Column({ type: 'integer', default: 0 })
    unread_count: number;

    @Column({ type: 'uuid', nullable: true })
    created_by_id?: string;

    @ManyToOne(() => AppUser, { nullable: true })
    @JoinColumn({ name: 'created_by_id' })
    created_by?: AppUser;

    @OneToMany(() => ChatParticipant, participant => participant.chat)
    participants: ChatParticipant[];

    @OneToMany(() => ChatMessage, message => message.chat)
    messages: ChatMessage[];
}

@Entity({ name: 'chat_participants' })
export class ChatParticipant {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    chat_id: string;

    @Column({ type: 'uuid' })
    user_id: string;

    @Column({ type: 'timestamptz', default: () => 'now()' })
    joined_at: Date;

    @Column({ type: 'timestamptz', nullable: true })
    last_read_at?: Date;

    @Column({ type: 'integer', default: 0 })
    unread_count: number;

    @Column({ type: 'text', default: 'member' })
    role: 'admin' | 'member';

    @ManyToOne(() => Chat, chat => chat.participants, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'chat_id' })
    chat: Chat;

    @ManyToOne(() => AppUser, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: AppUser;
}

@Entity({ name: 'chat_messages' })
export class ChatMessage {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    chat_id: string;

    @Column({ type: 'uuid' })
    user_id: string;

    @Column({ type: 'text' })
    content: string;

    @Column({ type: 'text', default: 'text' })
    type: 'text' | 'image' | 'file' | 'system';

    @Column({ type: 'jsonb', nullable: true })
    metadata?: Record<string, unknown>;

    @Column({ type: 'uuid', nullable: true })
    reply_to_id?: string;

    @Column({ type: 'timestamptz', default: () => 'now()' })
    created_at: Date;

    @Column({ type: 'timestamptz', default: () => 'now()' })
    updated_at: Date;

    @Column({ type: 'boolean', default: false })
    is_edited: boolean;

    @Column({ type: 'boolean', default: false })
    is_deleted: boolean;

    @ManyToOne(() => Chat, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'chat_id' })
    chat: Chat;

    @ManyToOne(() => AppUser, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: AppUser;

    @ManyToOne(() => ChatMessage, { nullable: true })
    @JoinColumn({ name: 'reply_to_id' })
    reply_to?: ChatMessage;
}

