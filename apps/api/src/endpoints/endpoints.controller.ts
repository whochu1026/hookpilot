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
import { CreateEndpointDto, UpdateEndpointDto } from './dto/endpoint.dto';
import { EndpointsService } from './endpoints.service';

@Controller('projects/:projectId/endpoints')
@UseGuards(JwtAuthGuard)
export class EndpointsController {
  constructor(private readonly endpointsService: EndpointsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
  ) {
    return this.endpointsService.list(user.id, projectId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateEndpointDto,
  ) {
    return this.endpointsService.create(user.id, projectId, dto);
  }

  @Patch(':endpointId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('endpointId') endpointId: string,
    @Body() dto: UpdateEndpointDto,
  ) {
    return this.endpointsService.update(user.id, projectId, endpointId, dto);
  }

  @Delete(':endpointId')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('endpointId') endpointId: string,
  ) {
    return this.endpointsService.remove(user.id, projectId, endpointId);
  }

  @Post(':endpointId/rotate-secret')
  rotateSecret(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('endpointId') endpointId: string,
  ) {
    return this.endpointsService.rotateSecret(user.id, projectId, endpointId);
  }
}
