import { IsOptional, IsString, IsUUID, IsEnum, IsNumber, IsDateString } from 'class-validator';

export class CreateChatDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    avatar_url?: string;

    @IsEnum(['direct', 'group'])
    type: 'direct' | 'group' = 'direct';

    @IsOptional()
    @IsUUID()
    created_by_id?: string;

    @IsOptional()
    @IsUUID()
    participant_user_id?: string;

}

export class UpdateChatDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    avatar_url?: string;
}

export class AddParticipantDto {
    @IsUUID()
    user_id: string;

    @IsOptional()
    @IsEnum(['admin', 'member'])
    role?: 'admin' | 'member' = 'member';
}

export class ChatResponseDto {
    id: string;
    name?: string;
    avatar_url?: string;
    type: 'direct' | 'group';
    created_at: Date;
    updated_at: Date;
    last_message_at?: Date;
    last_message_text?: string;
    last_message_user_id?: string;
    unread_count: number;
    created_by_id?: string;
    participants?: ChatParticipantResponseDto[];
    last_message?: ChatMessageResponseDto;
}

export class ChatParticipantResponseDto {
    id: string;
    chat_id: string;
    user_id: string;
    joined_at: Date;
    last_read_at?: Date;
    unread_count: number;
    role: 'admin' | 'member';
    user?: {
        id: string;
        name?: string;
        username?: string;
        avatar_url?: string;
        roles?: string[];
        owned_skills?: any[];
        desired_skills?: any[];
        created_at?: string;
        updated_at?: string;
        subscribers_count?: number;
        subscriptions_count?: number;
    };
}

export class ChatMessageResponseDto {
    id: string;
    chat_id: string;
    user_id: string;
    content: string;
    type: 'text' | 'image' | 'file' | 'system';
    metadata?: Record<string, unknown>;
    reply_to_id?: string;
    created_at: Date;
    updated_at: Date;
    is_edited: boolean;
    is_deleted: boolean;
    user?: {
        id: string;
        name?: string;
        username?: string;
        avatar_url?: string;
        roles?: string[];
        owned_skills?: any[];
        desired_skills?: any[];
        created_at?: string;
        updated_at?: string;
        subscribers_count?: number;
        subscriptions_count?: number;
    };
    reply_to?: ChatMessageResponseDto;
}

export class CreateMessageDto {
    @IsString()
    content: string;

    @IsOptional()
    @IsEnum(['text', 'image', 'file', 'system'])
    type?: 'text' | 'image' | 'file' | 'system' = 'text';

    @IsOptional()
    metadata?: Record<string, unknown>;

    @IsOptional()
    @IsUUID()
    reply_to_id?: string;
}

export class UpdateMessageDto {
    @IsString()
    content: string;
}

export class MarkAsReadDto {
    @IsOptional()
    @IsDateString()
    last_read_at?: string;
}
