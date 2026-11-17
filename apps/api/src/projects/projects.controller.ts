import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateApiKeyDto,
  CreateProjectDto,
  UpdateProjectDto,
} from './dto/project.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.projectsService.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user.id, dto);
  }

  @Get(':projectId')
  get(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    return this.projectsService.get(user.id, projectId);
  }

  @Patch(':projectId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(user.id, projectId, dto);
  }

  @Delete(':projectId')
  remove(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    return this.projectsService.remove(user.id, projectId);
  }

  @Post(':projectId/api-keys')
  createApiKey(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.projectsService.createApiKey(user.id, projectId, dto);
  }

  @Delete(':projectId/api-keys/:apiKeyId')
  revokeApiKey(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('apiKeyId') apiKeyId: string,
  ) {
    return this.projectsService.revokeApiKey(user.id, projectId, apiKeyId);
  }
}
