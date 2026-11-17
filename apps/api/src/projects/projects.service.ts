import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { generateApiKey } from '../common/crypto.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto, CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { endpoints: true, events: true, apiKeys: true } },
      },
    });
  }

  async get(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        apiKeys: {
          where: { revokedAt: null },
          select: {
            id: true,
            name: true,
            keyPrefix: true,
            lastUsedAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { endpoints: true, events: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.userId !== userId) throw new ForbiddenException();
    return project;
  }

  create(userId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        userId,
      },
    });
  }

  async update(userId: string, projectId: string, dto: UpdateProjectDto) {
    await this.assertOwnership(userId, projectId);
    return this.prisma.project.update({
      where: { id: projectId },
      data: dto,
    });
  }

  async remove(userId: string, projectId: string) {
    await this.assertOwnership(userId, projectId);
    await this.prisma.project.delete({ where: { id: projectId } });
    return { ok: true };
  }

  async createApiKey(userId: string, projectId: string, dto: CreateApiKeyDto) {
    await this.assertOwnership(userId, projectId);
    const generated = generateApiKey();
    const record = await this.prisma.apiKey.create({
      data: {
        projectId,
        name: dto.name,
        keyPrefix: generated.prefix,
        keyHash: generated.hash,
      },
    });

    return {
      id: record.id,
      name: record.name,
      keyPrefix: record.keyPrefix,
      apiKey: generated.raw,
      createdAt: record.createdAt,
      warning: 'Store this API key now. It will not be shown again.',
    };
  }

  async revokeApiKey(userId: string, projectId: string, apiKeyId: string) {
    await this.assertOwnership(userId, projectId);
    const key = await this.prisma.apiKey.findFirst({
      where: { id: apiKeyId, projectId },
    });
    if (!key) throw new NotFoundException('API key not found');
    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async assertOwnership(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.userId !== userId) throw new ForbiddenException();
    return project;
  }
}
