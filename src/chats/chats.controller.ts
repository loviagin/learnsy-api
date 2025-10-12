import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { JwtGuard, type JwtUser } from '../auth/jwt.guard';
import { ReqUser } from '../auth/user.decorator';
import { CreateChatDto, UpdateChatDto, AddParticipantDto, CreateMessageDto, UpdateMessageDto, MarkAsReadDto } from './dto/chat.dto';

@Controller('chats')
@UseGuards(JwtGuard)
export class ChatsController {
    constructor(private readonly chatsService: ChatsService) {}

    @Post()
    async createChat(@Body() createChatDto: CreateChatDto, @ReqUser() user: JwtUser) {
        return this.chatsService.createChat(createChatDto, user.sub);
    }

    @Get()
    async getUserChats(@ReqUser() user: JwtUser) {
        return this.chatsService.getUserChats(user.sub);
    }

    @Get(':id')
    async getChatById(@Param('id') id: string, @ReqUser() user: JwtUser) {
        return this.chatsService.getChatById(id, user.sub);
    }

    @Put(':id')
    async updateChat(@Param('id') id: string, @Body() updateChatDto: UpdateChatDto, @ReqUser() user: JwtUser) {
        return this.chatsService.updateChat(id, updateChatDto, user.sub);
    }

    @Post(':id/participants')
    async addParticipant(@Param('id') id: string, @Body() addParticipantDto: AddParticipantDto, @ReqUser() user: JwtUser) {
        return this.chatsService.addParticipant(id, addParticipantDto, user.sub);
    }

    @Delete(':id/participants/:userId')
    async removeParticipant(@Param('id') id: string, @Param('userId') userId: string, @ReqUser() user: JwtUser) {
        return this.chatsService.removeParticipant(id, userId, user.sub);
    }

    @Post(':id/messages')
    async createMessage(@Param('id') id: string, @Body() createMessageDto: CreateMessageDto, @ReqUser() user: JwtUser) {
        return this.chatsService.createMessage(id, createMessageDto, user.sub);
    }

    @Get(':id/messages')
    async getChatMessages(
        @Param('id') id: string,
        @ReqUser() user: JwtUser,
        @Query('limit') limit?: number,
        @Query('offset') offset?: number
    ) {
        return this.chatsService.getChatMessages(id, user.sub, limit, offset);
    }

    @Put('messages/:messageId')
    async updateMessage(@Param('messageId') messageId: string, @Body() updateMessageDto: UpdateMessageDto, @ReqUser() user: JwtUser) {
        return this.chatsService.updateMessage(messageId, updateMessageDto, user.sub);
    }

    @Delete('messages/:messageId')
    async deleteMessage(@Param('messageId') messageId: string, @ReqUser() user: JwtUser) {
        return this.chatsService.deleteMessage(messageId, user.sub);
    }

    @Post(':id/read')
    async markAsRead(@Param('id') id: string, @Body() markAsReadDto: MarkAsReadDto, @ReqUser() user: JwtUser) {
        return this.chatsService.markAsRead(id, user.sub, markAsReadDto);
    }
}
