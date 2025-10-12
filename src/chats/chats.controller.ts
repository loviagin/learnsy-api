import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { JwtGuard, type JwtUser } from '../auth/jwt.guard';
import { ReqUser } from '../auth/user.decorator';
import { CreateChatDto, UpdateChatDto, AddParticipantDto, CreateMessageDto, UpdateMessageDto, MarkAsReadDto } from './dto/chat.dto';
import { UsersService } from '../users/users.service';

@Controller('chats')
@UseGuards(JwtGuard)
export class ChatsController {
    constructor(
        private readonly chatsService: ChatsService,
        private readonly usersService: UsersService,
    ) {}

    private async getCurrentUserId(userSub: string): Promise<string> {
        const user = await this.usersService.findByAuthUserId(userSub);
        if (!user) {
            throw new Error('User not found');
        }
        return user.id;
    }

    @Post()
    async createChat(@Body() createChatDto: CreateChatDto, @ReqUser() user: JwtUser) {
        const userId = await this.getCurrentUserId(user.sub);
        return this.chatsService.createChat(createChatDto, userId);
    }

    @Get()
    async getUserChats(@ReqUser() user: JwtUser) {
        const userId = await this.getCurrentUserId(user.sub);
        return this.chatsService.getUserChats(userId);
    }

    @Get(':id')
    async getChatById(@Param('id') id: string, @ReqUser() user: JwtUser) {
        const userId = await this.getCurrentUserId(user.sub);
        return this.chatsService.getChatById(id, userId);
    }

    @Put(':id')
    async updateChat(@Param('id') id: string, @Body() updateChatDto: UpdateChatDto, @ReqUser() user: JwtUser) {
        const userId = await this.getCurrentUserId(user.sub);
        return this.chatsService.updateChat(id, updateChatDto, userId);
    }

    @Delete(':id')
    async deleteChat(@Param('id') id: string, @ReqUser() user: JwtUser) {
        const userId = await this.getCurrentUserId(user.sub);
        return this.chatsService.deleteChat(id, userId);
    }

    @Post(':id/participants')
    async addParticipant(@Param('id') id: string, @Body() addParticipantDto: AddParticipantDto, @ReqUser() user: JwtUser) {
        const userId = await this.getCurrentUserId(user.sub);
        return this.chatsService.addParticipant(id, addParticipantDto, userId);
    }

    @Delete(':id/participants/:userId')
    async removeParticipant(@Param('id') id: string, @Param('userId') userId: string, @ReqUser() user: JwtUser) {
        const currentUserId = await this.getCurrentUserId(user.sub);
        return this.chatsService.removeParticipant(id, userId, currentUserId);
    }

    @Post(':id/messages')
    async createMessage(@Param('id') id: string, @Body() createMessageDto: CreateMessageDto, @ReqUser() user: JwtUser) {
        const userId = await this.getCurrentUserId(user.sub);
        return this.chatsService.createMessage(id, createMessageDto, userId);
    }

    @Get(':id/messages')
    async getChatMessages(
        @Param('id') id: string,
        @ReqUser() user: JwtUser,
        @Query('limit') limit?: number,
        @Query('offset') offset?: number
    ) {
        const userId = await this.getCurrentUserId(user.sub);
        return this.chatsService.getChatMessages(id, userId, limit, offset);
    }

    @Put('messages/:messageId')
    async updateMessage(@Param('messageId') messageId: string, @Body() updateMessageDto: UpdateMessageDto, @ReqUser() user: JwtUser) {
        const userId = await this.getCurrentUserId(user.sub);
        return this.chatsService.updateMessage(messageId, updateMessageDto, userId);
    }

    @Delete('messages/:messageId')
    async deleteMessage(@Param('messageId') messageId: string, @ReqUser() user: JwtUser) {
        const userId = await this.getCurrentUserId(user.sub);
        return this.chatsService.deleteMessage(messageId, userId);
    }

    @Post(':id/read')
    async markAsRead(@Param('id') id: string, @Body() markAsReadDto: MarkAsReadDto, @ReqUser() user: JwtUser) {
        const userId = await this.getCurrentUserId(user.sub);
        return this.chatsService.markAsRead(id, userId, markAsReadDto);
    }
}
