export const WEBHOOK_QUEUE = 'webhook-delivery';

export type WebhookJobData = {
  eventId: string;
  attempt: number;
};
