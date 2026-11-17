import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [ProjectsModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
