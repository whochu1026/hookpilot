import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { QueueModule } from '../queue/queue.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [ProjectsModule, QueueModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
