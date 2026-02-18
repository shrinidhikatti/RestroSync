import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AppGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { branchId?: string; station?: string },
  ) {
    if (data.branchId) {
      client.join(`branch:${data.branchId}`);
      this.logger.debug(`Client ${client.id} joined branch:${data.branchId}`);
    }
    if (data.branchId && data.station) {
      client.join(`kitchen:${data.branchId}:${data.station}`);
      this.logger.debug(`Client ${client.id} joined kitchen:${data.branchId}:${data.station}`);
    }
  }

  /** Emit event to a branch room */
  emitToBranch(branchId: string, event: string, data: unknown) {
    this.server.to(`branch:${branchId}`).emit(event, data);
  }

  /** Emit event to a kitchen station room */
  emitToKitchen(branchId: string, station: string, event: string, data: unknown) {
    this.server.to(`kitchen:${branchId}:${station}`).emit(event, data);
  }

  /** Get connected socket count */
  getConnectionCount(): number {
    return this.server?.sockets?.sockets?.size || 0;
  }
}
