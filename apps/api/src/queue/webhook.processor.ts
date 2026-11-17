import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeliveryStatus, EventStatus, Prisma } from '@prisma/client';
import { Job, Queue } from 'bullmq';
import { computeBackoffMs, signPayload } from '../common/crypto.util';
import { PrismaService } from '../prisma/prisma.service';
import { WEBHOOK_QUEUE, WebhookJobData } from './queue.constants';

@Processor(WEBHOOK_QUEUE)
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);
  private readonly maxAttempts: number;
  private readonly timeoutMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(WEBHOOK_QUEUE) private readonly queue: Queue<WebhookJobData>,
  ) {
    super();
    this.maxAttempts = Number(this.config.get('WEBHOOK_MAX_ATTEMPTS', 5));
    this.timeoutMs = Number(this.config.get('WEBHOOK_TIMEOUT_MS', 10000));
  }

  async process(job: Job<WebhookJobData>): Promise<void> {
    const { eventId, attempt } = job.data;
    this.logger.log(`Delivering event=${eventId} attempt=${attempt}`);

    const event = await this.prisma.webhookEvent.findUnique({
      where: { id: eventId },
      include: { endpoint: true },
    });

    if (!event) {
      this.logger.warn(`Event ${eventId} not found, skipping`);
      return;
    }

    if (!event.endpoint.enabled) {
      await this.prisma.webhookEvent.update({
        where: { id: eventId },
        data: { status: EventStatus.FAILED },
      });
      return;
    }

    await this.prisma.webhookEvent.update({
      where: { id: eventId },
      data: { status: EventStatus.PROCESSING, attemptCount: attempt },
    });

    const body = JSON.stringify({
      id: event.id,
      type: event.eventType,
      created_at: event.createdAt.toISOString(),
      data: event.payload,
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signPayload(event.endpoint.secret, timestamp, body);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'HookPilot/1.0',
      'X-HookPilot-Event': event.eventType,
      'X-HookPilot-Delivery': `${event.id}.${attempt}`,
      'X-HookPilot-Timestamp': timestamp,
      'X-HookPilot-Signature': `sha256=${signature}`,
      'X-Idempotency-Key': event.idempotencyKey ?? event.id,
    };

    const started = Date.now();
    let responseStatus: number | null = null;
    let responseBody: string | null = null;
    let deliveryStatus: DeliveryStatus = DeliveryStatus.FAILED;
    let errorMessage: string | null = null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(event.endpoint.url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      responseStatus = res.status;
      responseBody = (await res.text())
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .slice(0, 8_000);
      deliveryStatus =
        res.status >= 200 && res.status < 300
          ? DeliveryStatus.SUCCESS
          : DeliveryStatus.FAILED;
      if (deliveryStatus === DeliveryStatus.FAILED) {
        errorMessage = `HTTP ${res.status}`;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('abort') || message.includes('AbortError')) {
        deliveryStatus = DeliveryStatus.TIMEOUT;
        errorMessage = 'Request timed out';
      } else {
        deliveryStatus = DeliveryStatus.FAILED;
        errorMessage = message;
      }
    } finally {
      clearTimeout(timer);
    }

    const responseTimeMs = Date.now() - started;

    await this.prisma.webhookDelivery.create({
      data: {
        eventId,
        attemptNumber: attempt,
        requestUrl: event.endpoint.url,
        requestHeaders: headers as Prisma.InputJsonValue,
        requestBody: JSON.parse(body) as Prisma.InputJsonValue,
        responseStatus,
        responseBody,
        responseTimeMs,
        status: deliveryStatus,
        errorMessage,
      },
    });

    if (deliveryStatus === DeliveryStatus.SUCCESS) {
      await this.prisma.webhookEvent.update({
        where: { id: eventId },
        data: {
          status: EventStatus.DELIVERED,
          nextRetryAt: null,
        },
      });
      return;
    }

    if (attempt >= this.maxAttempts) {
      await this.prisma.webhookEvent.update({
        where: { id: eventId },
        data: { status: EventStatus.DEAD, nextRetryAt: null },
      });
      this.logger.warn(`Event ${eventId} moved to DEAD after ${attempt} attempts`);
      return;
    }

    const baseSeconds = Number(this.config.get('WEBHOOK_BACKOFF_BASE_SECONDS', 10));
    const delay = computeBackoffMs(attempt, baseSeconds);
    const nextRetryAt = new Date(Date.now() + delay);
    await this.prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: EventStatus.FAILED,
        nextRetryAt,
      },
    });

    await this.queue.add(
      'deliver',
      { eventId, attempt: attempt + 1 },
      {
        delay,
        jobId: `${eventId}-${attempt + 1}`,
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );

    this.logger.log(
      `Scheduled retry for ${eventId} attempt=${attempt + 1} in ${delay}ms`,
    );
  }
}
