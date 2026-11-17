import { Injectable, NotFoundException } from '@nestjs/common';
import { generateEndpointSecret } from '../common/crypto.util';
import { ProjectsService } from '../projects/projects.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEndpointDto, UpdateEndpointDto } from './dto/endpoint.dto';

@Injectable()
export class EndpointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async list(userId: string, projectId: string) {
    await this.projects.assertOwnership(userId, projectId);
    return this.prisma.endpoint.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        url: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
        secret: true,
        _count: { select: { events: true } },
      },
    });
  }

  async create(userId: string, projectId: string, dto: CreateEndpointDto) {
    await this.projects.assertOwnership(userId, projectId);
    return this.prisma.endpoint.create({
      data: {
        projectId,
        name: dto.name,
        url: dto.url,
        secret: generateEndpointSecret(),
      },
    });
  }

  async update(
    userId: string,
    projectId: string,
    endpointId: string,
    dto: UpdateEndpointDto,
  ) {
    await this.projects.assertOwnership(userId, projectId);
    await this.assertEndpoint(projectId, endpointId);
    return this.prisma.endpoint.update({
      where: { id: endpointId },
      data: dto,
    });
  }

  async remove(userId: string, projectId: string, endpointId: string) {
    await this.projects.assertOwnership(userId, projectId);
    await this.assertEndpoint(projectId, endpointId);
    await this.prisma.endpoint.delete({ where: { id: endpointId } });
    return { ok: true };
  }

  async rotateSecret(userId: string, projectId: string, endpointId: string) {
    await this.projects.assertOwnership(userId, projectId);
    await this.assertEndpoint(projectId, endpointId);
    return this.prisma.endpoint.update({
      where: { id: endpointId },
      data: { secret: generateEndpointSecret() },
    });
  }

  private async assertEndpoint(projectId: string, endpointId: string) {
    const endpoint = await this.prisma.endpoint.findFirst({
      where: { id: endpointId, projectId },
    });
    if (!endpoint) throw new NotFoundException('Endpoint not found');
    return endpoint;
  }
}
