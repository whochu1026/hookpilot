'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { api, User } from '@/lib/api';

type Delivery = {
  id: string;
  attemptNumber: number;
  requestUrl: string;
  requestHeaders: Record<string, string>;
  requestBody: unknown;
  responseStatus: number | null;
  responseBody: string | null;
  responseTimeMs: number | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
};

type EventDetail = {
  id: string;
  eventType: string;
  status: string;
  attemptCount: number;
  idempotencyKey?: string | null;
  payload: unknown;
  createdAt: string;
  endpoint: { name: string; url: string; secret: string };
  deliveries: Delivery[];
};

export default function EventDetailPage() {
  const { projectId, eventId } = useParams<{ projectId: string; eventId: string }>();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [event, setEvent] = useState<EventDetail | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await api<User>('/auth/me');
        setUser(me);
        const detail = await api<EventDetail>(
          `/projects/${projectId}/events/${eventId}`,
        );
        setEvent(detail);
      } catch {
        router.replace('/');
      }
    })();
  }, [projectId, eventId, router]);

  async function redeliver() {
    await api(`/projects/${projectId}/events/${eventId}/redeliver`, { method: 'POST' });
    const detail = await api<EventDetail>(`/projects/${projectId}/events/${eventId}`);
    setEvent(detail);
  }

  if (!event) {
    return (
      <main className="shell">
        <p className="muted">Loading event…</p>
      </main>
    );
  }

  return (
    <main className="shell fade-up">
      <AppHeader email={user?.email} />
      <Link href={`/dashboard/projects/${projectId}`} className="crumb">
        ← Back to project
      </Link>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          margin: '10px 0 18px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 className="page-title mono" style={{ margin: 0 }}>
            {event.eventType}
          </h1>
          <div className="delivery-meta" style={{ marginTop: 8 }}>
            <StatusBadge status={event.status} />
            <span className="mono muted" style={{ fontSize: 12 }}>
              {event.id}
            </span>
          </div>
        </div>
        <button className="btn" type="button" onClick={redeliver}>
          Redeliver
        </button>
      </div>

      <section className="panel panel-pad" style={{ marginBottom: 16 }}>
        <h3 className="panel-title">Event</h3>
        <dl className="meta-grid">
          <dt>Endpoint</dt>
          <dd>
            {event.endpoint.name} · <span className="mono muted">{event.endpoint.url}</span>
          </dd>
          <dt>Attempts</dt>
          <dd className="mono">{event.attemptCount}</dd>
          <dt>Idempotency</dt>
          <dd className="mono">{event.idempotencyKey || '—'}</dd>
          <dt>Payload</dt>
          <dd>
            <pre className="mono code-block">{JSON.stringify(event.payload, null, 2)}</pre>
          </dd>
        </dl>
      </section>

      <section className="panel panel-pad">
        <h3 className="panel-title">Delivery attempts</h3>
        {event.deliveries.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            No delivery attempts yet.
          </p>
        ) : (
          <div className="list-stack">
            {event.deliveries.map((d) => (
              <article key={d.id} className="delivery-card">
                <div className="delivery-head">
                  <div className="delivery-meta">
                    <strong className="mono">#{d.attemptNumber}</strong>
                    <StatusBadge status={d.status} />
                    {d.responseStatus != null && (
                      <span className="mono muted" style={{ fontSize: 12 }}>
                        HTTP {d.responseStatus}
                      </span>
                    )}
                    {d.responseTimeMs != null && (
                      <span className="mono muted" style={{ fontSize: 12 }}>
                        {d.responseTimeMs}ms
                      </span>
                    )}
                  </div>
                  <span className="mono muted" style={{ fontSize: 12 }}>
                    {new Date(d.createdAt).toLocaleString()}
                  </span>
                </div>
                {d.errorMessage && (
                  <p className="alert alert-err" style={{ marginBottom: 8 }}>
                    {d.errorMessage}
                  </p>
                )}
                <details>
                  <summary className="muted" style={{ cursor: 'pointer', fontSize: 13 }}>
                    Request / Response
                  </summary>
                  <pre className="mono code-block" style={{ marginTop: 10, fontSize: 11 }}>
                    {JSON.stringify(
                      {
                        requestHeaders: d.requestHeaders,
                        requestBody: d.requestBody,
                        responseBody: d.responseBody,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
