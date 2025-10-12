import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat, ChatParticipant, ChatMessage } from './chat.entity';
import { AppUser } from '../users/app-user.entity';
import { CreateChatDto, UpdateChatDto, AddParticipantDto, CreateMessageDto, UpdateMessageDto, MarkAsReadDto, ChatResponseDto, ChatParticipantResponseDto, ChatMessageResponseDto } from './dto/chat.dto';

@Injectable()
export class ChatsService {
    constructor(
        @InjectRepository(Chat)
        private chatRepository: Repository<Chat>,
        @InjectRepository(ChatParticipant)
        private participantRepository: Repository<ChatParticipant>,
        @InjectRepository(ChatMessage)
        private messageRepository: Repository<ChatMessage>,
        @InjectRepository(AppUser)
        private userRepository: Repository<AppUser>,
    ) {}

    async createChat(createChatDto: CreateChatDto, currentUserSub: string): Promise<ChatResponseDto> {
        // Get current user by auth_user_id (sub)
        console.log(`[ChatService] Looking for current user with auth_user_id: ${currentUserSub}`);
        const currentUser = await this.userRepository.findOne({
            where: { auth_user_id: currentUserSub },
        });
        console.log(`[ChatService] Current user found:`, currentUser ? `${currentUser.id} (${currentUser.name})` : 'null');
        if (!currentUser) {
            throw new NotFoundException('Current user not found');
        }

        // For direct chats, verify that the participant user exists
        if (createChatDto.type === 'direct' && createChatDto.participant_auth_user_id) {
            console.log(`[ChatService] Looking for participant with auth_user_id: ${createChatDto.participant_auth_user_id}`);
            const participantUser = await this.userRepository.findOne({
                where: { auth_user_id: createChatDto.participant_auth_user_id },
            });
            console.log(`[ChatService] Participant user found:`, participantUser ? `${participantUser.id} (${participantUser.name})` : 'null');
            if (!participantUser) {
                throw new NotFoundException('Participant user not found');
            }
        }

        const chat = this.chatRepository.create({
            ...createChatDto,
            created_by_id: currentUser.id,
        });

        const savedChat = await this.chatRepository.save(chat);

        // Add creator as participant directly (bypass admin check for creator)
        const creatorParticipant = this.participantRepository.create({
            chat_id: savedChat.id,
            user_id: currentUser.id,
            role: 'admin',
        });
        await this.participantRepository.save(creatorParticipant);

        // For direct chats, add the other participant
        if (createChatDto.type === 'direct' && createChatDto.participant_auth_user_id) {
            const participantUser = await this.userRepository.findOne({
                where: { auth_user_id: createChatDto.participant_auth_user_id },
            });
            if (participantUser) {
                await this.addParticipant(savedChat.id, { user_id: participantUser.id, role: 'member' }, currentUserSub);
            }
        }

        return this.formatChatResponse(savedChat);
    }

    async getUserChats(userSub: string): Promise<ChatResponseDto[]> {
        const user = await this.userRepository.findOne({
            where: { auth_user_id: userSub },
        });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const participants = await this.participantRepository.find({
            where: { user_id: user.id },
            relations: ['chat', 'chat.participants', 'chat.participants.user'],
            order: { chat: { last_message_at: 'DESC' } },
        });

        const chats = participants.map(p => p.chat);
        return Promise.all(chats.map(chat => this.formatChatResponse(chat)));
    }

    async getChatById(chatId: string, userSub: string): Promise<ChatResponseDto> {
        const user = await this.userRepository.findOne({
            where: { auth_user_id: userSub },
        });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const participant = await this.participantRepository.findOne({
            where: { chat_id: chatId, user_id: user.id },
            relations: ['chat', 'chat.participants', 'chat.participants.user'],
        });

        if (!participant) {
            throw new NotFoundException('Chat not found or access denied');
        }

        return this.formatChatResponse(participant.chat);
    }

    async updateChat(chatId: string, updateChatDto: UpdateChatDto, userSub: string): Promise<ChatResponseDto> {
        const user = await this.userRepository.findOne({
            where: { auth_user_id: userSub },
        });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const participant = await this.participantRepository.findOne({
            where: { chat_id: chatId, user_id: user.id },
            relations: ['chat'],
        });

        if (!participant || participant.role !== 'admin') {
            throw new ForbiddenException('Only admins can update chat');
        }

        await this.chatRepository.update(chatId, updateChatDto);
        const updatedChat = await this.chatRepository.findOne({
            where: { id: chatId },
            relations: ['participants', 'participants.user'],
        });

        if (!updatedChat) {
            throw new NotFoundException('Chat not found');
        }

        return this.formatChatResponse(updatedChat);
    }

    async addParticipant(chatId: string, addParticipantDto: AddParticipantDto, currentUserSub: string): Promise<ChatParticipantResponseDto> {
        const user = await this.userRepository.findOne({
            where: { auth_user_id: currentUserSub },
        });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const currentParticipant = await this.participantRepository.findOne({
            where: { chat_id: chatId, user_id: user.id },
        });

        if (!currentParticipant || currentParticipant.role !== 'admin') {
            throw new ForbiddenException('Only admins can add participants');
        }

        const existingParticipant = await this.participantRepository.findOne({
            where: { chat_id: chatId, user_id: addParticipantDto.user_id },
        });

        if (existingParticipant) {
            throw new ForbiddenException('User is already a participant');
        }

        const participant = this.participantRepository.create({
            chat_id: chatId,
            user_id: addParticipantDto.user_id,
            role: addParticipantDto.role,
        });

        const savedParticipant = await this.participantRepository.save(participant);
        return this.formatParticipantResponse(savedParticipant);
    }

    async removeParticipant(chatId: string, userId: string, currentUserSub: string): Promise<void> {
        const user = await this.userRepository.findOne({
            where: { auth_user_id: currentUserSub },
        });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const currentParticipant = await this.participantRepository.findOne({
            where: { chat_id: chatId, user_id: user.id },
        });

        if (!currentParticipant || currentParticipant.role !== 'admin') {
            throw new ForbiddenException('Only admins can remove participants');
        }

        await this.participantRepository.delete({ chat_id: chatId, user_id: userId });
    }

    async createMessage(chatId: string, createMessageDto: CreateMessageDto, userSub: string): Promise<ChatMessageResponseDto> {
        console.log(`[ChatService] Creating message in chat ${chatId} by user ${userSub}`);
        console.log(`[ChatService] Message content: ${createMessageDto.content}`);
        
        const user = await this.userRepository.findOne({
            where: { auth_user_id: userSub },
        });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const participant = await this.participantRepository.findOne({
            where: { chat_id: chatId, user_id: user.id },
        });

        if (!participant) {
            throw new ForbiddenException('You are not a participant of this chat');
        }

        const message = this.messageRepository.create({
            chat_id: chatId,
            user_id: user.id,
            ...createMessageDto,
        });

        const savedMessage = await this.messageRepository.save(message);
        console.log(`[ChatService] Message saved with ID: ${savedMessage.id}`);

        // Update chat's last message info
        await this.chatRepository.update(chatId, {
            last_message_at: savedMessage.created_at,
            last_message_text: savedMessage.content,
            last_message_user_id: user.id,
            updated_at: new Date(),
        });

        // Increment unread count for all participants except sender
        await this.participantRepository
            .createQueryBuilder()
            .update(ChatParticipant)
            .set({ unread_count: () => 'unread_count + 1' })
            .where('chat_id = :chatId AND user_id != :userId', { chatId, userId: user.id })
            .execute();

        return this.formatMessageResponse(savedMessage);
    }

    async getChatMessages(chatId: string, userSub: string, limit: number = 50, offset: number = 0): Promise<ChatMessageResponseDto[]> {
        console.log(`[ChatService] Getting messages for chat ${chatId} by user ${userSub}`);
        
        const user = await this.userRepository.findOne({
            where: { auth_user_id: userSub },
        });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const participant = await this.participantRepository.findOne({
            where: { chat_id: chatId, user_id: user.id },
        });

        if (!participant) {
            throw new ForbiddenException('You are not a participant of this chat');
        }

        const messages = await this.messageRepository.find({
            where: { chat_id: chatId },
            relations: ['user', 'reply_to', 'reply_to.user'],
            order: { created_at: 'DESC' },
            take: limit,
            skip: offset,
        });

        console.log(`[ChatService] Found ${messages.length} messages for chat ${chatId}`);
        return messages.map(message => this.formatMessageResponse(message));
    }

    async updateMessage(messageId: string, updateMessageDto: UpdateMessageDto, userSub: string): Promise<ChatMessageResponseDto> {
        const user = await this.userRepository.findOne({
            where: { auth_user_id: userSub },
        });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const message = await this.messageRepository.findOne({
            where: { id: messageId, user_id: user.id },
            relations: ['user', 'reply_to', 'reply_to.user'],
        });

        if (!message) {
            throw new NotFoundException('Message not found or you are not the author');
        }

        await this.messageRepository.update(messageId, {
            content: updateMessageDto.content,
            is_edited: true,
            updated_at: new Date(),
        });

        const updatedMessage = await this.messageRepository.findOne({
            where: { id: messageId },
            relations: ['user', 'reply_to', 'reply_to.user'],
        });

        if (!updatedMessage) {
            throw new NotFoundException('Message not found');
        }

        return this.formatMessageResponse(updatedMessage);
    }

    async deleteMessage(messageId: string, userSub: string): Promise<void> {
        const user = await this.userRepository.findOne({
            where: { auth_user_id: userSub },
        });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const message = await this.messageRepository.findOne({
            where: { id: messageId, user_id: user.id },
        });

        if (!message) {
            throw new NotFoundException('Message not found or you are not the author');
        }

        await this.messageRepository.update(messageId, {
            is_deleted: true,
            content: 'Message deleted',
            updated_at: new Date(),
        });
    }

    async markAsRead(chatId: string, userSub: string, markAsReadDto: MarkAsReadDto): Promise<void> {
        const user = await this.userRepository.findOne({
            where: { auth_user_id: userSub },
        });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const participant = await this.participantRepository.findOne({
            where: { chat_id: chatId, user_id: user.id },
        });

        if (!participant) {
            throw new ForbiddenException('You are not a participant of this chat');
        }

        const lastReadAt = markAsReadDto.last_read_at ? new Date(markAsReadDto.last_read_at) : new Date();

        await this.participantRepository.update(
            { chat_id: chatId, user_id: user.id },
            {
                last_read_at: lastReadAt,
                unread_count: 0,
            }
        );
    }

    private async formatChatResponse(chat: Chat): Promise<ChatResponseDto> {
        // If participants are not loaded with user data, load them
        if (!chat.participants || chat.participants.some(p => !p.user)) {
            chat.participants = await this.participantRepository.find({
                where: { chat_id: chat.id },
                relations: ['user'],
            });
        }

        const lastMessage = await this.messageRepository.findOne({
            where: { chat_id: chat.id },
            relations: ['user'],
            order: { created_at: 'DESC' },
        });

        return {
            id: chat.id,
            name: chat.name,
            avatar_url: chat.avatar_url,
            type: chat.type,
            created_at: chat.created_at,
            updated_at: chat.updated_at,
            last_message_at: chat.last_message_at,
            last_message_text: chat.last_message_text,
            last_message_user_id: chat.last_message_user_id,
            unread_count: chat.unread_count,
            created_by_id: chat.created_by_id,
            participants: chat.participants?.map(p => this.formatParticipantResponse(p)),
            last_message: lastMessage ? this.formatMessageResponse(lastMessage) : undefined,
        };
    }

    private formatParticipantResponse(participant: ChatParticipant): ChatParticipantResponseDto {
        return {
            id: participant.id,
            chat_id: participant.chat_id,
            user_id: participant.user_id,
            joined_at: participant.joined_at,
            last_read_at: participant.last_read_at,
            unread_count: participant.unread_count,
            role: participant.role,
            user: participant.user ? {
                id: participant.user.id,
                name: participant.user.name,
                username: participant.user.username,
                avatar_url: participant.user.avatar_url,
            } : undefined,
        };
    }

    private formatMessageResponse(message: ChatMessage): ChatMessageResponseDto {
        return {
            id: message.id,
            chat_id: message.chat_id,
            user_id: message.user_id,
            content: message.content,
            type: message.type,
            metadata: message.metadata,
            reply_to_id: message.reply_to_id,
            created_at: message.created_at,
            updated_at: message.updated_at,
            is_edited: message.is_edited,
            is_deleted: message.is_deleted,
            user: message.user ? {
                id: message.user.id,
                name: message.user.name,
                username: message.user.username,
                avatar_url: message.user.avatar_url,
            } : undefined,
            reply_to: message.reply_to ? this.formatMessageResponse(message.reply_to) : undefined,
        };
    }
}
