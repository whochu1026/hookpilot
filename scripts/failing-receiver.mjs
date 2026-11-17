#!/usr/bin/env node
/**
 * Demo webhook receiver that fails the first N attempts per delivery key,
 * then returns 200. Used to showcase HookPilot exponential backoff retries.
 *
 * Usage:
 *   node scripts/failing-receiver.mjs
 *   FAIL_UNTIL=2 PORT=4099 node scripts/failing-receiver.mjs
 */
import http from 'node:http';

const PORT = Number(process.env.PORT || 4099);
const FAIL_UNTIL = Number(process.env.FAIL_UNTIL || 2);

/** @type {Map<string, number>} */
const attemptsByEvent = new Map();

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, failUntil: FAIL_UNTIL }));
    return;
  }

  if (req.method === 'GET' && req.url === '/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        failUntil: FAIL_UNTIL,
        events: Object.fromEntries(attemptsByEvent),
      }),
    );
    return;
  }

  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.writeHead(404).end('not found');
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');

  const delivery = req.headers['x-hookpilot-delivery'] || 'unknown';
  const eventId = String(delivery).split('.')[0];
  const attempt = Number(String(delivery).split('.')[1] || '0');
  const seen = (attemptsByEvent.get(eventId) || 0) + 1;
  attemptsByEvent.set(eventId, seen);

  const signature = req.headers['x-hookpilot-signature'];
  const timestamp = req.headers['x-hookpilot-timestamp'];

  if (seen <= FAIL_UNTIL) {
    console.log(
      `[FAIL ] event=${eventId} attempt=${attempt || seen} seen=${seen}/${FAIL_UNTIL} → 503`,
    );
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: false,
        reason: 'simulated outage',
        attempt: seen,
        failUntil: FAIL_UNTIL,
      }),
    );
    return;
  }

  console.log(
    `[OK   ] event=${eventId} attempt=${attempt || seen} seen=${seen} sig=${String(signature).slice(0, 24)}… ts=${timestamp}`,
  );
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      ok: true,
      receivedAt: new Date().toISOString(),
      attempt: seen,
      body: (() => {
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      })(),
    }),
  );
});

server.listen(PORT, () => {
  console.log(`Failing receiver on http://localhost:${PORT}/webhook`);
  console.log(`Fails first ${FAIL_UNTIL} attempt(s) per event, then succeeds`);
});
