import { Injectable } from '@nestjs/common';
import { DeliveryStatus, EventStatus } from '@prisma/client';
import { ProjectsService } from '../projects/projects.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async getProjectStats(userId: string, projectId: string) {
    await this.projects.assertOwnership(userId, projectId);

    const [eventsByStatus, deliveries, recentDeliveries] = await Promise.all([
      this.prisma.webhookEvent.groupBy({
        by: ['status'],
        where: { projectId },
        _count: { _all: true },
      }),
      this.prisma.webhookDelivery.findMany({
        where: { event: { projectId } },
        select: {
          status: true,
          responseTimeMs: true,
          createdAt: true,
        },
      }),
      this.prisma.webhookDelivery.findMany({
        where: { event: { projectId } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          event: {
            select: {
              id: true,
              eventType: true,
              status: true,
            },
          },
        },
      }),
    ]);

    const totalDeliveries = deliveries.length;
    const successCount = deliveries.filter(
      (d) => d.status === DeliveryStatus.SUCCESS,
    ).length;
    const failedCount = totalDeliveries - successCount;
    const avgResponseMs =
      totalDeliveries === 0
        ? 0
        : Math.round(
            deliveries.reduce((sum, d) => sum + (d.responseTimeMs ?? 0), 0) /
              totalDeliveries,
          );

    const statusMap = Object.fromEntries(
      (Object.values(EventStatus) as EventStatus[]).map((s) => [s, 0]),
    ) as Record<EventStatus, number>;

    for (const row of eventsByStatus) {
      statusMap[row.status] = row._count._all;
    }

    return {
      events: statusMap,
      deliveries: {
        total: totalDeliveries,
        success: successCount,
        failed: failedCount,
        successRate:
          totalDeliveries === 0
            ? 0
            : Math.round((successCount / totalDeliveries) * 1000) / 10,
        avgResponseMs,
      },
      recentDeliveries,
    };
  }
}
