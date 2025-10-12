import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtGuard, type JwtUser } from '../auth/jwt.guard';
import { ReqUser } from '../auth/user.decorator';
import { UsersService } from '../users/users.service';

@Controller('notifications')
@UseGuards(JwtGuard)
export class NotificationsController {
    constructor(
        private readonly notificationsService: NotificationsService,
        private readonly usersService: UsersService,
    ) {}

    private async getCurrentUserId(userSub: string): Promise<string> {
        const user = await this.usersService.findByAuthUserId(userSub);
        if (!user) {
            throw new Error('User not found');
        }
        return user.id;
    }

    @Post('register-token')
    async registerToken(
        @Body() body: { token: string; platform?: string },
        @ReqUser() user: JwtUser
    ) {
        const userId = await this.getCurrentUserId(user.sub);
        return this.notificationsService.registerDeviceToken(userId, body.token, body.platform || 'ios');
    }
}
