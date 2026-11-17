import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EventStatus } from '@prisma/client';
import { Request } from 'express';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateEventDto } from './dto/event.dto';
import { EventsService } from './events.service';

@Controller()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  /** Public ingestion API — authenticated via project API key. */
  @UseGuards(ApiKeyGuard)
  @Post('v1/events')
  createPublic(
    @Req() req: Request & { projectId: string },
    @Body() dto: CreateEventDto,
  ) {
    return this.eventsService.createViaApiKey(req.projectId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('projects/:projectId/events')
  createDashboard(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateEventDto,
  ) {
    return this.eventsService.createViaJwt(user.id, projectId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('projects/:projectId/events')
  list(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Query('status') status?: EventStatus,
  ) {
    return this.eventsService.list(user.id, projectId, status);
  }

  @UseGuards(JwtAuthGuard)
  @Get('projects/:projectId/events/:eventId')
  get(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.eventsService.get(user.id, projectId, eventId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('projects/:projectId/events/:eventId/redeliver')
  redeliver(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.eventsService.redeliver(user.id, projectId, eventId);
  }
}
