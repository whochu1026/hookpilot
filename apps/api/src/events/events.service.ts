import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { EventStatus, Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { ProjectsService } from '../projects/projects.service';
import { PrismaService } from '../prisma/prisma.service';
import { WEBHOOK_QUEUE, WebhookJobData } from '../queue/queue.constants';
import { CreateEventDto } from './dto/event.dto';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    @InjectQueue(WEBHOOK_QUEUE) private readonly queue: Queue<WebhookJobData>,
  ) {}

  async createViaJwt(userId: string, projectId: string, dto: CreateEventDto) {
    await this.projects.assertOwnership(userId, projectId);
    return this.createEvent(projectId, dto);
  }

  async createViaApiKey(projectId: string, dto: CreateEventDto) {
    return this.createEvent(projectId, dto);
  }

  private async createEvent(projectId: string, dto: CreateEventDto) {
    const endpoint = await this.prisma.endpoint.findFirst({
      where: { id: dto.endpointId, projectId, enabled: true },
    });
    if (!endpoint) {
      throw new NotFoundException('Endpoint not found or disabled');
    }

    if (dto.idempotencyKey) {
      const existing = await this.prisma.webhookEvent.findUnique({
        where: {
          projectId_idempotencyKey: {
            projectId,
            idempotencyKey: dto.idempotencyKey,
          },
        },
        include: { deliveries: { orderBy: { attemptNumber: 'desc' }, take: 1 } },
      });
      if (existing) {
        return { event: existing, duplicated: true };
      }
    }

    try {
      const event = await this.prisma.webhookEvent.create({
        data: {
          projectId,
          endpointId: dto.endpointId,
          eventType: dto.eventType,
          payload: dto.payload as Prisma.InputJsonValue,
          idempotencyKey: dto.idempotencyKey,
          status: EventStatus.PENDING,
        },
      });

      try {
        await this.queue.add(
          'deliver',
          { eventId: event.id, attempt: 1 },
          {
            jobId: `${event.id}-1`,
            removeOnComplete: 1000,
            removeOnFail: 5000,
          },
        );
      } catch (queueError) {
        await this.prisma.webhookEvent.update({
          where: { id: event.id },
          data: { status: EventStatus.FAILED },
        });
        throw queueError;
      }

      return { event, duplicated: false };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Duplicate idempotency key');
      }
      throw error;
    }
  }

  async list(userId: string, projectId: string, status?: EventStatus) {
    await this.projects.assertOwnership(userId, projectId);
    return this.prisma.webhookEvent.findMany({
      where: {
        projectId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        endpoint: { select: { id: true, name: true, url: true } },
        _count: { select: { deliveries: true } },
      },
    });
  }

  async get(userId: string, projectId: string, eventId: string) {
    await this.projects.assertOwnership(userId, projectId);
    const event = await this.prisma.webhookEvent.findFirst({
      where: { id: eventId, projectId },
      include: {
        endpoint: true,
        deliveries: { orderBy: { attemptNumber: 'asc' } },
      },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async redeliver(userId: string, projectId: string, eventId: string) {
    await this.projects.assertOwnership(userId, projectId);
    const event = await this.prisma.webhookEvent.findFirst({
      where: { id: eventId, projectId },
    });
    if (!event) throw new NotFoundException('Event not found');

    const nextAttempt = event.attemptCount + 1;
    if (nextAttempt > 20) {
      throw new BadRequestException('Maximum manual redelivery attempts exceeded');
    }

    const updated = await this.prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: EventStatus.PENDING,
        nextRetryAt: null,
      },
    });

    try {
      await this.queue.add(
        'deliver',
        { eventId: event.id, attempt: nextAttempt },
        {
          jobId: `${event.id}-manual-${Date.now()}`,
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      );
    } catch (queueError) {
      await this.prisma.webhookEvent.update({
        where: { id: eventId },
        data: { status: EventStatus.FAILED },
      });
      throw queueError;
    }

    return updated;
  }
}
