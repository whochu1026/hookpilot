import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WEBHOOK_QUEUE } from './queue.constants';
import { WebhookProcessor } from './webhook.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: Number(config.get('REDIS_PORT', 6379)),
        },
      }),
    }),
    BullModule.registerQueue({ name: WEBHOOK_QUEUE }),
  ],
  providers: [WebhookProcessor],
  exports: [BullModule],
})
export class QueueModule {}
