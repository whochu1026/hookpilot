import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { EndpointsController } from './endpoints.controller';
import { EndpointsService } from './endpoints.service';

@Module({
  imports: [ProjectsModule],
  controllers: [EndpointsController],
  providers: [EndpointsService],
  exports: [EndpointsService],
})
export class EndpointsModule {}
