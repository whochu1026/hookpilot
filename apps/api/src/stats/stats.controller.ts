import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StatsService } from './stats.service';

@Controller('projects/:projectId/stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  get(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    return this.statsService.getProjectStats(user.id, projectId);
  }
}
