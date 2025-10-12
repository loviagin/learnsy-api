import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat, ChatParticipant, ChatMessage } from './chat.entity';
import { AppUser } from '../users/app-user.entity';
import { CreateChatDto, UpdateChatDto, AddParticipantDto, CreateMessageDto, UpdateMessageDto, MarkAsReadDto, ChatResponseDto, ChatParticipantResponseDto, ChatMessageResponseDto } from './dto/chat.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatsGateway } from './chats.gateway';

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
        private notificationsService: NotificationsService,
        private chatsGateway: ChatsGateway,
    ) {}

    async createChat(createChatDto: CreateChatDto, currentUserId: string): Promise<ChatResponseDto> {
        // Get current user by id
        console.log(`[ChatService] Looking for current user with id: ${currentUserId}`);
        const currentUser = await this.userRepository.findOne({
            where: { id: currentUserId },
        });
        console.log(`[ChatService] Current user found:`, currentUser ? `${currentUser.id} (${currentUser.name})` : 'null');
        if (!currentUser) {
            throw new NotFoundException('Current user not found');
        }

        // For direct chats, verify that the participant user exists
        if (createChatDto.type === 'direct' && createChatDto.participant_user_id) {
            console.log(`[ChatService] Looking for participant with id: ${createChatDto.participant_user_id}`);
            const participantUser = await this.userRepository.findOne({
                where: { id: createChatDto.participant_user_id },
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
        const savedCreatorParticipant = await this.participantRepository.save(creatorParticipant);
        console.log(`[ChatService] Creator participant saved:`, {
            id: savedCreatorParticipant.id,
            chat_id: savedCreatorParticipant.chat_id,
            user_id: savedCreatorParticipant.user_id,
            role: savedCreatorParticipant.role
        });

        // For direct chats, add the other participant
        if (createChatDto.type === 'direct' && createChatDto.participant_user_id) {
            await this.addParticipant(savedChat.id, { user_id: createChatDto.participant_user_id, role: 'member' }, currentUserId);
        }

        const chatResponse = await this.formatChatResponse(savedChat);
        
        // Notify participants about new chat
        const participants = await this.participantRepository.find({
            where: { chat_id: savedChat.id }
        });
        
        for (const participant of participants) {
            await this.chatsGateway.notifyNewChat(participant.user_id, chatResponse);
        }

        return chatResponse;
    }

    async getUserChats(userId: string): Promise<ChatResponseDto[]> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
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

    async deleteChat(chatId: string, userId: string): Promise<void> {
        console.log(`[ChatService] Delete chat request: chatId=${chatId}, userId=${userId}`);
        
        const user = await this.userRepository.findOne({
            where: { id: userId },
        });
        if (!user) {
            console.log(`[ChatService] User not found: ${userId}`);
            throw new NotFoundException('User not found');
        }

        const chat = await this.chatRepository.findOne({
            where: { id: chatId },
            relations: ['participants'],
        });
        if (!chat) {
            console.log(`[ChatService] Chat not found: ${chatId}`);
            throw new NotFoundException('Chat not found');
        }

        console.log(`[ChatService] Chat participants:`, chat.participants?.map(p => `${p.user_id}:${p.role}`));
        console.log(`[ChatService] Looking for user ${userId} in participants`);

        // Check if user is admin of the chat
        const participant = chat.participants?.find(p => p.user_id === userId);
        console.log(`[ChatService] Found participant:`, participant ? `${participant.user_id}:${participant.role}` : 'null');
        
        if (participant) {
            console.log(`[ChatService] Participant details:`, {
                id: participant.id,
                chat_id: participant.chat_id,
                user_id: participant.user_id,
                role: participant.role,
                joined_at: participant.joined_at
            });
        }
        
        if (!participant) {
            console.log(`[ChatService] User ${userId} is not a participant of chat ${chatId}`);
            throw new ForbiddenException('You are not a participant of this chat');
        }

        // For direct chats, any participant can delete the chat
        // For group chats, only admins can delete
        if (chat.type === 'group' && participant.role !== 'admin') {
            console.log(`[ChatService] User ${userId} is not admin of group chat ${chatId}`);
            throw new ForbiddenException('Only admins can delete group chats');
        }

        console.log(`[ChatService] User ${userId} can delete chat ${chatId} (type: ${chat.type}, role: ${participant.role})`);

        // Get all participants before deletion
        const participants = await this.participantRepository.find({
            where: { chat_id: chatId }
        });

        // Delete all messages first
        await this.messageRepository.delete({ chat_id: chatId });
        
        // Delete all participants
        await this.participantRepository.delete({ chat_id: chatId });
        
        // Delete the chat
        await this.chatRepository.delete({ id: chatId });

        // Notify all participants about chat deletion
        for (const participant of participants) {
            await this.chatsGateway.notifyChatDeleted(participant.user_id, chatId);
        }
    }

    async getChatById(chatId: string, userId: string): Promise<ChatResponseDto> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
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

    async updateChat(chatId: string, updateChatDto: UpdateChatDto, userId: string): Promise<ChatResponseDto> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
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

    async addParticipant(chatId: string, addParticipantDto: AddParticipantDto, currentUserId: string): Promise<ChatParticipantResponseDto> {
        const user = await this.userRepository.findOne({
            where: { id: currentUserId },
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

    async removeParticipant(chatId: string, userId: string, currentUserId: string): Promise<void> {
        const user = await this.userRepository.findOne({
            where: { id: currentUserId },
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

    async createMessage(chatId: string, createMessageDto: CreateMessageDto, userId: string): Promise<ChatMessageResponseDto> {
        console.log(`[ChatService] Creating message in chat ${chatId} by user ${userId}`);
        console.log(`[ChatService] Message content: ${createMessageDto.content}`);
        
        const user = await this.userRepository.findOne({
            where: { id: userId },
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

        // Send notifications to other participants
        console.log(`[ChatService] Looking for other participants in chat ${chatId}`);
        const otherParticipants = await this.participantRepository.find({
            where: { chat_id: chatId },
            relations: ['user']
        });

        console.log(`[ChatService] Found ${otherParticipants.length} total participants`);
        otherParticipants.forEach(p => {
            console.log(`[ChatService] Participant: ${p.user_id} (${p.user?.name || p.user?.username || 'Unknown'})`);
        });

        const recipientUserIds = otherParticipants
            .filter(p => p.user_id !== user.id)
            .map(p => p.user_id);

        console.log(`[ChatService] Recipient user IDs: ${JSON.stringify(recipientUserIds)}`);

        if (recipientUserIds.length > 0) {
            console.log(`[ChatService] Sending notifications to ${recipientUserIds.length} recipients`);
            await this.notificationsService.sendChatNotification(
                chatId,
                savedMessage.content,
                user.name || user.username || 'Unknown User',
                recipientUserIds
            );
        } else {
            console.log(`[ChatService] No other participants to notify`);
        }

        const messageResponse = this.formatMessageResponse(savedMessage);
        
        // Notify chat participants about new message via WebSocket
        await this.chatsGateway.notifyNewMessage(chatId, messageResponse, user.id);

        return messageResponse;
    }

    async getChatMessages(chatId: string, userId: string, limit: number = 50, offset: number = 0): Promise<ChatMessageResponseDto[]> {
        console.log(`[ChatService] Getting messages for chat ${chatId} by user ${userId}`);
        
        const user = await this.userRepository.findOne({
            where: { id: userId },
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

    async updateMessage(messageId: string, updateMessageDto: UpdateMessageDto, userId: string): Promise<ChatMessageResponseDto> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
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

    async deleteMessage(messageId: string, userId: string): Promise<void> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
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

    async markAsRead(chatId: string, userId: string, markAsReadDto: MarkAsReadDto): Promise<void> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
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

        const response = {
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
        
        console.log(`[ChatService] Formatting chat response for chat ${chat.id}:`);
        console.log(`[ChatService] created_at: ${chat.created_at} (type: ${typeof chat.created_at})`);
        console.log(`[ChatService] updated_at: ${chat.updated_at} (type: ${typeof chat.updated_at})`);
        console.log(`[ChatService] last_message_at: ${chat.last_message_at} (type: ${typeof chat.last_message_at})`);
        
        return response;
    }

    private formatParticipantResponse(participant: ChatParticipant): ChatParticipantResponseDto {
        console.log(`[ChatService] Formatting participant ${participant.user?.id}: avatar_url=${participant.user?.avatar_url}`);
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
