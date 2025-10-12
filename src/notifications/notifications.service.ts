import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceToken } from './device-token.entity';
import * as apn from 'apn';

@Injectable()
export class NotificationsService {
    private apnProvider: apn.Provider;

    constructor(
        @InjectRepository(DeviceToken) private deviceTokenRepository: Repository<DeviceToken>,
    ) {
        // Initialize APNs provider
        // Note: You'll need to add your APNs certificate/key to the project
        this.initializeApnProvider();
    }

    private initializeApnProvider() {
        try {
            // Check if APNs key is available
            const keyPath = process.env.APNS_KEY_PATH;
            const keyId = process.env.APNS_KEY_ID;
            const teamId = process.env.APNS_TEAM_ID;

            if (!keyPath || !keyId || !teamId) {
                console.log('⚠️ APNs configuration missing. Set APNS_KEY_PATH, APNS_KEY_ID, and APNS_TEAM_ID environment variables.');
                return;
            }

            const options = {
                token: {
                    key: keyPath,
                    keyId: keyId,
                    teamId: teamId,
                },
                production: process.env.NODE_ENV === 'production',
            };

            this.apnProvider = new apn.Provider(options);
            console.log('✅ APNs provider initialized with key-based authentication');
        } catch (error) {
            console.log('❌ Failed to initialize APNs provider:', error);
            // Continue without APNs for now
        }
    }

    async registerDeviceToken(userId: string, token: string, platform: string = 'ios'): Promise<DeviceToken> {
        console.log(`📱 [NotificationsService] Registering device token for user ${userId}`);
        console.log(`📱 [NotificationsService] Token: ${token.substring(0, 20)}...`);
        
        // Check if token already exists
        let deviceToken = await this.deviceTokenRepository.findOne({
            where: { token, user_id: userId }
        });

        if (deviceToken) {
            // Update existing token
            console.log(`📱 [NotificationsService] Updating existing token`);
            deviceToken.is_active = true;
            deviceToken.updated_at = new Date();
            const savedToken = await this.deviceTokenRepository.save(deviceToken);
            console.log(`📱 [NotificationsService] Token updated successfully`);
            return savedToken;
        } else {
            // Create new token
            console.log(`📱 [NotificationsService] Creating new token`);
            deviceToken = this.deviceTokenRepository.create({
                user_id: userId,
                token,
                platform,
                is_active: true
            });
            const savedToken = await this.deviceTokenRepository.save(deviceToken);
            console.log(`📱 [NotificationsService] Token created successfully with ID: ${savedToken.id}`);
            return savedToken;
        }
    }

    async sendChatNotification(
        chatId: string,
        messageContent: string,
        senderName: string,
        recipientUserIds: string[]
    ): Promise<void> {
        console.log(`📱 [NotificationsService] Starting notification for chat ${chatId}`);
        console.log(`📱 [NotificationsService] Recipient user IDs: ${JSON.stringify(recipientUserIds)}`);
        
        // Get device tokens for all recipients
        const deviceTokens = await this.deviceTokenRepository.find({
            where: recipientUserIds.map(userId => ({ user_id: userId, is_active: true }))
        });

        console.log(`📱 [NotificationsService] Found ${deviceTokens.length} device tokens`);
        deviceTokens.forEach(token => {
            console.log(`📱 [NotificationsService] Token for user ${token.user_id}: ${token.token.substring(0, 20)}...`);
        });

        console.log(`📱 [NotificationsService] Notification details:`);
        console.log(`   Sender: ${senderName}`);
        console.log(`   Message: ${messageContent}`);
        console.log(`   Recipients: ${recipientUserIds.length} users, ${deviceTokens.length} tokens`);

        if (!this.apnProvider) {
            console.log('❌ APNs provider not initialized, skipping push notifications');
            return;
        }

        // Send push notifications via APNs
        for (const deviceToken of deviceTokens) {
            try {
                const notification = new apn.Notification();
                notification.alert = {
                    title: `New message from ${senderName}`,
                    body: messageContent.length > 100 ? messageContent.substring(0, 100) + '...' : messageContent
                };
                notification.badge = 1;
                notification.sound = 'default';
                notification.payload = {
                    chatId: chatId,
                    type: 'chat_message'
                };
                notification.topic = process.env.APNS_BUNDLE_ID || 'com.yourcompany.skillify';

                const result = await this.apnProvider.send(notification, deviceToken.token);
                
                if (result.failed && result.failed.length > 0) {
                    console.log(`❌ Failed to send notification to ${deviceToken.token.substring(0, 20)}...:`, result.failed[0].error);
                } else {
                    console.log(`✅ Notification sent to ${deviceToken.token.substring(0, 20)}...`);
                }
            } catch (error) {
                console.log(`❌ Error sending notification to ${deviceToken.token.substring(0, 20)}...:`, error);
            }
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
