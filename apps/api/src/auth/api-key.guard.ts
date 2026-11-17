import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { sha256 } from '../common/crypto.util';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.header('x-api-key') || req.header('authorization');
    if (!header) throw new UnauthorizedException('API key required');

    const raw = header.startsWith('Bearer ') ? header.slice(7) : header;
    const keyHash = sha256(raw);
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: { project: true },
    });

    if (!apiKey || apiKey.revokedAt) {
      throw new UnauthorizedException('Invalid API key');
    }

    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    (req as Request & { projectId: string; apiKeyId: string }).projectId =
      apiKey.projectId;
    (req as Request & { projectId: string; apiKeyId: string }).apiKeyId = apiKey.id;
    return true;
  }
}
