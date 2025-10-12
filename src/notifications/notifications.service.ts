import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceToken } from './device-token.entity';

@Injectable()
export class NotificationsService {
    constructor(
        @InjectRepository(DeviceToken) private deviceTokenRepository: Repository<DeviceToken>,
    ) {}

    async registerDeviceToken(userId: string, token: string, platform: string = 'ios'): Promise<DeviceToken> {
        // Check if token already exists
        let deviceToken = await this.deviceTokenRepository.findOne({
            where: { token, user_id: userId }
        });

        if (deviceToken) {
            // Update existing token
            deviceToken.is_active = true;
            deviceToken.updated_at = new Date();
            return this.deviceTokenRepository.save(deviceToken);
        } else {
            // Create new token
            deviceToken = this.deviceTokenRepository.create({
                user_id: userId,
                token,
                platform,
                is_active: true
            });
            return this.deviceTokenRepository.save(deviceToken);
        }
    }

    async sendChatNotification(
        chatId: string,
        messageContent: string,
        senderName: string,
        recipientUserIds: string[]
    ): Promise<void> {
        // Get device tokens for all recipients
        const deviceTokens = await this.deviceTokenRepository.find({
            where: recipientUserIds.map(userId => ({ user_id: userId, is_active: true }))
        });

        console.log(`📱 Notification for chat ${chatId}:`);
        console.log(`   Sender: ${senderName}`);
        console.log(`   Message: ${messageContent}`);
        console.log(`   Recipients: ${recipientUserIds.length} users, ${deviceTokens.length} tokens`);

        // TODO: Send actual push notifications to device tokens
        // For now, just log the notification data
        for (const deviceToken of deviceTokens) {
            console.log(`   📱 Sending to token: ${deviceToken.token.substring(0, 20)}...`);
        }
    }

    async getDeviceTokensForUser(userId: string): Promise<string[]> {
        const tokens = await this.deviceTokenRepository.find({
            where: { user_id: userId, is_active: true },
            select: ['token']
        });
        return tokens.map(t => t.token);
    }
}
