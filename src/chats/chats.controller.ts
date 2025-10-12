import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { JwtGuard } from '../auth/jwt.guard';
import { ReqUser } from '../auth/user.decorator';
import { CreateChatDto, UpdateChatDto, AddParticipantDto, CreateMessageDto, UpdateMessageDto, MarkAsReadDto } from './dto/chat.dto';

@Controller('chats')
@UseGuards(JwtGuard)
export class ChatsController {
    constructor(private readonly chatsService: ChatsService) {}

    @Post()
    async createChat(@Body() createChatDto: CreateChatDto, @ReqUser() user: any) {
        return this.chatsService.createChat(createChatDto, user.id);
    }

    @Get()
    async getUserChats(@ReqUser() user: any) {
        return this.chatsService.getUserChats(user.id);
    }

    @Get(':id')
    async getChatById(@Param('id') id: string, @ReqUser() user: any) {
        return this.chatsService.getChatById(id, user.id);
    }

    @Put(':id')
    async updateChat(@Param('id') id: string, @Body() updateChatDto: UpdateChatDto, @ReqUser() user: any) {
        return this.chatsService.updateChat(id, updateChatDto, user.id);
    }

    @Post(':id/participants')
    async addParticipant(@Param('id') id: string, @Body() addParticipantDto: AddParticipantDto, @ReqUser() user: any) {
        return this.chatsService.addParticipant(id, addParticipantDto, user.id);
    }

    @Delete(':id/participants/:userId')
    async removeParticipant(@Param('id') id: string, @Param('userId') userId: string, @ReqUser() user: any) {
        return this.chatsService.removeParticipant(id, userId, user.id);
    }

    @Post(':id/messages')
    async createMessage(@Param('id') id: string, @Body() createMessageDto: CreateMessageDto, @ReqUser() user: any) {
        return this.chatsService.createMessage(id, createMessageDto, user.id);
    }

    @Get(':id/messages')
    async getChatMessages(
        @Param('id') id: string,
        @ReqUser() user: any,
        @Query('limit') limit?: number,
        @Query('offset') offset?: number
    ) {
        return this.chatsService.getChatMessages(id, user.id, limit, offset);
    }

    @Put('messages/:messageId')
    async updateMessage(@Param('messageId') messageId: string, @Body() updateMessageDto: UpdateMessageDto, @ReqUser() user: any) {
        return this.chatsService.updateMessage(messageId, updateMessageDto, user.id);
    }

    @Delete('messages/:messageId')
    async deleteMessage(@Param('messageId') messageId: string, @ReqUser() user: any) {
        return this.chatsService.deleteMessage(messageId, user.id);
    }

    @Post(':id/read')
    async markAsRead(@Param('id') id: string, @Body() markAsReadDto: MarkAsReadDto, @ReqUser() user: any) {
        return this.chatsService.markAsRead(id, user.id, markAsReadDto);
    }
}
