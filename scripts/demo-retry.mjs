#!/usr/bin/env node
/**
 * End-to-end retry demo:
 * 1) ensure auth / project / failing endpoint / api key
 * 2) enqueue event
 * 3) poll until DELIVERED (or timeout)
 * 4) print delivery attempt timeline
 *
 * Prerequisites:
 *   - API running on :3001
 *   - Redis + Postgres up
 *   - failing-receiver on :4099
 *   - WEBHOOK_BACKOFF_BASE_SECONDS=2 recommended for a quick demo
 */
const API = process.env.API_URL || 'http://localhost:3001/api';
const RECEIVER = process.env.RECEIVER_URL || 'http://localhost:4099/webhook';
const EMAIL = process.env.DEMO_EMAIL || 'retry-demo@hookpilot.test';
const PASSWORD = process.env.DEMO_PASSWORD || 'password123';

async function api(path, { method = 'GET', token, apiKey, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (apiKey) headers['X-API-Key'] = apiKey;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('=== HookPilot Retry Demo ===');
  console.log(`API=${API}`);
  console.log(`Receiver=${RECEIVER}`);

  // Auth
  let token;
  try {
    ({ accessToken: token } = await api('/auth/login', {
      method: 'POST',
      body: { email: EMAIL, password: PASSWORD },
    }));
  } catch {
    ({ accessToken: token } = await api('/auth/register', {
      method: 'POST',
      body: { email: EMAIL, password: PASSWORD, name: 'Retry Demo' },
    }));
  }
  console.log('✓ authenticated');

  // Project
  let projects = await api('/projects', { token });
  let project = projects.find((p) => p.name === 'Retry Demo') || null;
  if (!project) {
    project = await api('/projects', {
      method: 'POST',
      token,
      body: { name: 'Retry Demo', description: 'Exponential backoff showcase' },
    });
  }
  console.log(`✓ project ${project.id}`);

  // Endpoint pointing at failing receiver
  let endpoints = await api(`/projects/${project.id}/endpoints`, { token });
  let endpoint =
    endpoints.find((e) => e.url === RECEIVER) ||
    (await api(`/projects/${project.id}/endpoints`, {
      method: 'POST',
      token,
      body: { name: 'failing-receiver', url: RECEIVER },
    }));
  console.log(`✓ endpoint ${endpoint.id} → ${endpoint.url}`);

  // API key
  const keyRes = await api(`/projects/${project.id}/api-keys`, {
    method: 'POST',
    token,
    body: { name: `demo-${Date.now()}` },
  });
  const apiKey = keyRes.apiKey;
  console.log(`✓ api key ${keyRes.keyPrefix}…`);

  // Enqueue event
  const idem = `retry-demo-${Date.now()}`;
  const created = await api('/v1/events', {
    method: 'POST',
    apiKey,
    body: {
      endpointId: endpoint.id,
      eventType: 'demo.retry',
      payload: { message: 'expect failures then success', when: new Date().toISOString() },
      idempotencyKey: idem,
    },
  });
  const eventId = created.event.id;
  console.log(`✓ queued event ${eventId} (idempotency=${idem})`);
  console.log('… waiting for retries (FAILED → backoff → SUCCESS)');

  const started = Date.now();
  let lastStatus = '';
  let detail;

  while (Date.now() - started < 90_000) {
    detail = await api(`/projects/${project.id}/events/${eventId}`, { token });
    if (detail.status !== lastStatus) {
      const elapsed = ((Date.now() - started) / 1000).toFixed(1);
      console.log(
        `  [${elapsed}s] status=${detail.status} attempts=${detail.attemptCount} deliveries=${detail.deliveries.length}`,
      );
      lastStatus = detail.status;
    }
    if (detail.status === 'DELIVERED' || detail.status === 'DEAD') break;
    await sleep(800);
  }

  console.log('\n--- Delivery timeline ---');
  for (const d of detail.deliveries) {
    console.log(
      `  #${d.attemptNumber} ${d.status.padEnd(8)} HTTP ${String(d.responseStatus ?? '-').padEnd(3)} ${String(d.responseTimeMs ?? '-').padStart(4)}ms  ${d.errorMessage || ''}`,
    );
  }

  const stats = await api(`/projects/${project.id}/stats`, { token });
  console.log('\n--- Project stats ---');
  console.log(
    `  successRate=${stats.deliveries.successRate}%  avgResponse=${stats.deliveries.avgResponseMs}ms  total=${stats.deliveries.total}`,
  );

  if (detail.status !== 'DELIVERED') {
    console.error(`\nDemo did not reach DELIVERED (final=${detail.status})`);
    process.exit(1);
  }

  console.log('\n✓ Retry demo completed successfully');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
