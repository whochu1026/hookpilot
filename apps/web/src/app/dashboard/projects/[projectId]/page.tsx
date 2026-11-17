'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { api, User } from '@/lib/api';

type Project = {
  id: string;
  name: string;
  description?: string | null;
  apiKeys: Array<{
    id: string;
    name: string;
    keyPrefix: string;
    lastUsedAt?: string | null;
    createdAt: string;
  }>;
};

type Endpoint = {
  id: string;
  name: string;
  url: string;
  secret: string;
  enabled: boolean;
};

type EventRow = {
  id: string;
  eventType: string;
  status: string;
  attemptCount: number;
  createdAt: string;
  endpoint: { id: string; name: string; url: string };
  _count: { deliveries: number };
};

type Stats = {
  events: Record<string, number>;
  deliveries: {
    total: number;
    success: number;
    failed: number;
    successRate: number;
    avgResponseMs: number;
  };
};

const TABS = ['overview', 'endpoints', 'events', 'keys'] as const;

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>('overview');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [endpointName, setEndpointName] = useState('Local receiver');
  const [endpointUrl, setEndpointUrl] = useState('https://httpbin.org/post');
  const [apiKeyName, setApiKeyName] = useState('Default');
  const [createdApiKey, setCreatedApiKey] = useState('');
  const [eventType, setEventType] = useState('order.created');
  const [eventEndpointId, setEventEndpointId] = useState('');
  const [eventPayload, setEventPayload] = useState('{"orderId":"ord_1001","amount":42000}');
  const [idempotencyKey, setIdempotencyKey] = useState('');

  const refresh = useCallback(async () => {
    const [me, proj, eps, evs, st] = await Promise.all([
      api<User>('/auth/me'),
      api<Project>(`/projects/${projectId}`),
      api<Endpoint[]>(`/projects/${projectId}/endpoints`),
      api<EventRow[]>(`/projects/${projectId}/events`),
      api<Stats>(`/projects/${projectId}/stats`),
    ]);
    setUser(me);
    setProject(proj);
    setEndpoints(eps);
    setEvents(evs);
    setStats(st);
    if (!eventEndpointId && eps[0]) setEventEndpointId(eps[0].id);
  }, [projectId, eventEndpointId]);

  useEffect(() => {
    refresh().catch(() => router.replace('/'));
  }, [refresh, router]);

  async function createEndpoint(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api(`/projects/${projectId}/endpoints`, {
        method: 'POST',
        body: JSON.stringify({ name: endpointName, url: endpointUrl }),
      });
      setMessage('Endpoint created');
      await refresh();
      setTab('endpoints');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function createApiKey(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await api<{ apiKey: string }>(`/projects/${projectId}/api-keys`, {
        method: 'POST',
        body: JSON.stringify({ name: apiKeyName }),
      });
      setCreatedApiKey(res.apiKey);
      setMessage('API key created — copy it now');
      await refresh();
      setTab('keys');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function sendEvent(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const payload = JSON.parse(eventPayload);
      await api(`/projects/${projectId}/events`, {
        method: 'POST',
        body: JSON.stringify({
          endpointId: eventEndpointId,
          eventType,
          payload,
          idempotencyKey: idempotencyKey || undefined,
        }),
      });
      setMessage('Event queued for delivery');
      setIdempotencyKey('');
      await refresh();
      setTab('events');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function redeliver(eventId: string) {
    await api(`/projects/${projectId}/events/${eventId}/redeliver`, { method: 'POST' });
    setMessage('Redelivery queued');
    setTimeout(() => refresh(), 800);
  }

  if (!project) {
    return (
      <main className="shell">
        <p className="muted">Loading project…</p>
      </main>
    );
  }

  return (
    <main className="shell fade-up">
      <AppHeader email={user?.email} />

      <div style={{ marginBottom: 18 }}>
        <Link href="/dashboard" className="crumb">
          ← Projects
        </Link>
        <h1 className="page-title">{project.name}</h1>
        {project.description && <p className="page-desc">{project.description}</p>}
      </div>

      {(message || error) && (
        <p className={`alert ${error ? 'alert-err' : 'alert-ok'}`}>{error || message}</p>
      )}

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={`tab ${tab === t ? 'tab-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
        <button type="button" className="tab tab-refresh" onClick={() => refresh()}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M21 12a9 9 0 1 1-2.6-6.4" />
            <path d="M21 3v6h-6" />
          </svg>
          Refresh
        </button>
      </div>

      {tab === 'overview' && stats && (
        <div className="stack-gap">
          <section className="panel panel-pad">
            <div className="stats-grid">
              <Stat label="Success rate" value={`${stats.deliveries.successRate}%`} />
              <Stat label="Avg response" value={`${stats.deliveries.avgResponseMs} ms`} />
              <Stat label="Deliveries" value={String(stats.deliveries.total)} />
              <Stat
                label="Failed / Dead"
                value={String((stats.events.FAILED || 0) + (stats.events.DEAD || 0))}
              />
            </div>
          </section>

          <section className="panel panel-pad">
            <h3 className="panel-title">Send test event</h3>
            <form onSubmit={sendEvent} className="form-stack" style={{ maxWidth: 640 }}>
              <div className="field">
                <label>Endpoint</label>
                <select
                  value={eventEndpointId}
                  onChange={(e) => setEventEndpointId(e.target.value)}
                  required
                >
                  <option value="">Select endpoint</option>
                  {endpoints.map((ep) => (
                    <option key={ep.id} value={ep.id}>
                      {ep.name} — {ep.url}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Event type</label>
                <input value={eventType} onChange={(e) => setEventType(e.target.value)} required />
              </div>
              <div className="field">
                <label>Payload (JSON)</label>
                <textarea
                  rows={4}
                  className="mono"
                  value={eventPayload}
                  onChange={(e) => setEventPayload(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>Idempotency key (optional)</label>
                <input
                  className="mono"
                  value={idempotencyKey}
                  onChange={(e) => setIdempotencyKey(e.target.value)}
                  placeholder="ord_1001"
                />
              </div>
              <button className="btn" type="submit" disabled={!eventEndpointId}>
                Queue delivery
              </button>
            </form>
          </section>
        </div>
      )}

      {tab === 'endpoints' && (
        <div className="split-grid">
          <section className="panel panel-pad" style={{ overflow: 'auto' }}>
            <h3 className="panel-title">Registered endpoints</h3>
            {endpoints.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                No endpoints yet.
              </p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>URL</th>
                    <th>Secret</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoints.map((ep) => (
                    <tr key={ep.id}>
                      <td>{ep.name}</td>
                      <td className="mono muted">{ep.url}</td>
                      <td className="mono muted">{ep.secret.slice(0, 18)}…</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <section className="panel panel-pad" style={{ alignSelf: 'start' }}>
            <h3 className="panel-title">Add endpoint</h3>
            <form onSubmit={createEndpoint} className="form-stack">
              <div className="field">
                <label>Name</label>
                <input
                  value={endpointName}
                  onChange={(e) => setEndpointName(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>URL</label>
                <input
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  required
                />
              </div>
              <button className="btn" type="submit">
                Create endpoint
              </button>
            </form>
          </section>
        </div>
      )}

      {tab === 'events' && (
        <section className="panel panel-pad" style={{ overflow: 'auto' }}>
          <h3 className="panel-title">Delivery events</h3>
          {events.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              아직 이벤트가 없습니다. Overview에서 테스트 이벤트를 보내보세요.
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Endpoint</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id}>
                    <td className="mono">{ev.eventType}</td>
                    <td>
                      <StatusBadge status={ev.status} />
                    </td>
                    <td className="mono">{ev.attemptCount}</td>
                    <td>{ev.endpoint.name}</td>
                    <td className="mono muted">{new Date(ev.createdAt).toLocaleString()}</td>
                    <td>
                      <div className="inline-actions">
                        <Link
                          href={`/dashboard/projects/${projectId}/events/${ev.id}`}
                          className="btn btn-ghost btn-sm"
                        >
                          Detail
                        </Link>
                        {ev.status !== 'DELIVERED' && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => redeliver(ev.id)}
                          >
                            Redeliver
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {tab === 'keys' && (
        <div className="split-grid">
          <section className="panel panel-pad">
            <h3 className="panel-title">API keys</h3>
            {createdApiKey && (
              <div className="notice">
                <p>Copy this key now:</p>
                <code className="mono" style={{ fontSize: 12, wordBreak: 'break-all' }}>
                  {createdApiKey}
                </code>
              </div>
            )}
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Prefix</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {project.apiKeys.map((k) => (
                  <tr key={k.id}>
                    <td>{k.name}</td>
                    <td className="mono">{k.keyPrefix}…</td>
                    <td className="mono muted">{new Date(k.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="panel panel-pad" style={{ alignSelf: 'start' }}>
            <h3 className="panel-title">Issue API key</h3>
            <form onSubmit={createApiKey} className="form-stack">
              <div className="field">
                <label>Name</label>
                <input value={apiKeyName} onChange={(e) => setApiKeyName(e.target.value)} required />
              </div>
              <button className="btn" type="submit">
                Create key
              </button>
            </form>
            <p className="muted" style={{ fontSize: 13, marginTop: 14, lineHeight: 1.5 }}>
              Ingest with <code className="mono">POST /api/v1/events</code> and{' '}
              <code className="mono">X-API-Key</code>.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
