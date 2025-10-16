import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets = new Map<string, Set<string>>(); // userId -> Set of socketIds

  constructor(private readonly usersService: UsersService) {}

  async handleConnection(client: AuthenticatedSocket) {
    console.log(`🔌 WebSocket client connected: ${client.id}`);
    
    // Extract token from handshake auth, headers, or query parameters
    let token = 
      client.handshake.auth?.token || 
      client.handshake.headers?.authorization?.replace('Bearer ', '') ||
      client.handshake.query?.token;
    
    // Handle case where query parameter is an array
    if (Array.isArray(token)) {
      token = token[0];
    }
    
    if (!token || typeof token !== 'string') {
      console.log(`❌ No valid token provided for socket ${client.id}`);
      client.disconnect();
      return;
    }
    
    console.log(`🔑 Token received from socket ${client.id}: ${token.substring(0, 20)}...`);

    try {
      // Verify token and get user
      // Note: In a real implementation, you'd verify the JWT token here
      // For now, we'll extract user ID from token (simplified)
      const userId = await this.getUserIdFromToken(token);
      
      if (!userId) {
        console.log(`❌ Invalid token for socket ${client.id}`);
        client.disconnect();
        return;
      }

      client.userId = userId;
      
      // Add socket to user's socket set
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);
      
      console.log(`✅ User ${userId} connected with socket ${client.id}`);
      
      // Join user to their personal room
      await client.join(`user:${userId}`);
      
    } catch (error) {
      console.log(`❌ Authentication failed for socket ${client.id}:`, error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    console.log(`🔌 WebSocket client disconnected: ${client.id}`);
    
    if (client.userId) {
      const userSockets = this.userSockets.get(client.userId);
      if (userSockets) {
        userSockets.delete(client.id);
        if (userSockets.size === 0) {
          this.userSockets.delete(client.userId);
        }
      }
      console.log(`✅ User ${client.userId} disconnected socket ${client.id}`);
    }
  }

  @SubscribeMessage('join_chat')
  async handleJoinChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { chatId: string }
  ) {
    if (!client.userId) {
      return { error: 'Not authenticated' };
    }

    console.log(`🔌 User ${client.userId} joining chat ${data.chatId}`);
    await client.join(`chat:${data.chatId}`);
    
    return { success: true, chatId: data.chatId };
  }

  @SubscribeMessage('leave_chat')
  async handleLeaveChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { chatId: string }
  ) {
    if (!client.userId) {
      return { error: 'Not authenticated' };
    }

    console.log(`🔌 User ${client.userId} leaving chat ${data.chatId}`);
    await client.leave(`chat:${data.chatId}`);
    
    return { success: true, chatId: data.chatId };
  }

  // Method to notify chat participants about new message
  async notifyNewMessage(chatId: string, message: any, senderId: string) {
    console.log(`📡 Broadcasting new message to chat ${chatId}`);
    this.server.to(`chat:${chatId}`).emit('new_message', {
      chatId,
      message,
      senderId,
    });
  }

  // Method to notify chat participants about chat updates
  async notifyChatUpdate(chatId: string, update: any) {
    console.log(`📡 Broadcasting chat update to chat ${chatId}`);
    this.server.to(`chat:${chatId}`).emit('chat_update', {
      chatId,
      update,
    });
  }

  // Method to notify user about new chat
  async notifyNewChat(userId: string, chat: any) {
    console.log(`📡 Broadcasting new chat to user ${userId}`);
    this.server.to(`user:${userId}`).emit('new_chat', chat);
  }

  // Method to notify user about chat deletion
  async notifyChatDeleted(userId: string, chatId: string) {
    console.log(`📡 Broadcasting chat deletion to user ${userId}`);
    this.server.to(`user:${userId}`).emit('chat_deleted', { chatId });
  }

  private async getUserIdFromToken(token: string): Promise<string | null> {
    try {
      // Use the same validation method as JwtGuard
      const USERINFO_URL = 'https://auth.lovig.in/api/oidc/me';
      
      const response = await fetch(USERINFO_URL, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        console.log(`❌ Token validation failed: ${response.status}`);
        return null;
      }
      
      const userInfo = await response.json() as { sub: string; email?: string; name?: string };
      
      if (!userInfo.sub) {
        console.log('❌ Invalid token: missing sub claim');
        return null;
      }
      
      // Find user by auth_user_id (OIDC sub)
      const user = await this.usersService.findByAuthUserId(userInfo.sub);
      
      if (!user) {
        console.log(`❌ User not found for auth_user_id: ${userInfo.sub}`);
        return null;
      }
      
      console.log(`✅ Authenticated user: ${user.id} (${user.name || user.username})`);
      return user.id;
    } catch (error) {
      console.log('❌ Error verifying token:', error);
      return null;
    }
  }
}
