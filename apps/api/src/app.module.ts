import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { EndpointsModule } from './endpoints/endpoints.module';
import { EventsModule } from './events/events.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { QueueModule } from './queue/queue.module';
import { StatsModule } from './stats/stats.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    QueueModule,
    AuthModule,
    ProjectsModule,
    EndpointsModule,
    EventsModule,
    StatsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
