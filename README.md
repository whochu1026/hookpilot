# HookPilot

## 이 프로젝트는?

| | |
|---|---|
| **무엇을** | 웹훅 전송·실패 재시도·이력을 한곳에서 관리하는 Webhook Delivery Platform |
| **왜** | 수신 서버 장애로 이벤트가 유실되거나, 실패 원인을 추적하기 어려운 문제를 풀기 위해 |
| **어떻게** | NestJS API가 이벤트를 받아 BullMQ/Redis Worker가 전달하고, Exponential Backoff·Idempotency·HMAC으로 신뢰성을 보장. Next.js 대시보드로 확인 |

**한 줄:** 웹훅이 제대로 전달됐는지, 실패했다면 왜 실패했는지 한곳에서 확인하세요.

외부 서비스로 이벤트를 전달하고, 전송 실패·재시도·이력을 관리하는 개발자용 SaaS입니다.

쇼핑몰에서 주문이 생성되면 물류 시스템에 웹훅을 보내야 합니다. 상대 서버가 일시적으로 다운되면 이벤트가 유실될 수 있습니다. HookPilot은 그 사이에서 신뢰성 있는 전달 계층을 제공합니다.

---

## 해결하려는 문제

| 문제 | HookPilot의 대응 |
|------|------------------|
| 수신 서버 일시 장애로 이벤트 유실 | Exponential Backoff 재시도 + Dead letter 상태 |
| 같은 이벤트가 두 번 들어가는 문제 | Idempotency Key로 중복 생성 방지 |
| 실패 원인을 알 수 없음 | 요청/응답 Body·HTTP Status·응답 시간 기록 |
| 서명을 검증할 수 없음 | HMAC-SHA256 (`X-HookPilot-Signature`) |

---

## 시스템 아키텍처

```
┌─────────────┐     JWT      ┌──────────────────┐
│  Next.js    │─────────────▶│  NestJS API      │
│  Dashboard  │              │  /api/*          │
└─────────────┘              └────────┬─────────┘
                                      │
         X-API-Key                    │ enqueue
┌─────────────┐              ┌────────▼─────────┐
│  Client App │─────────────▶│  BullMQ Queue    │
│  POST /v1/  │              │  (Redis)         │
│  events     │              └────────┬─────────┘
└─────────────┘                       │
                             ┌────────▼─────────┐
                             │  Worker          │
                             │  HMAC + HTTP POST│
                             └────────┬─────────┘
                                      ▼
                             ┌──────────────────┐
                             │  Customer        │
                             │  Endpoint URL    │
                             └──────────────────┘

Persistence: PostgreSQL (Prisma)
  users → projects → api_keys / endpoints / webhook_events → webhook_deliveries
```

**이벤트와 전송 시도를 분리**합니다. 하나의 `webhook_event`는 여러 번의 `webhook_delivery`를 가질 수 있습니다.

---

## ERD

```
users
 └── projects
      ├── api_keys
      ├── endpoints
      └── webhook_events
           └── webhook_deliveries
```

### 상태 머신 (`webhook_events.status`)

`PENDING → PROCESSING → DELIVERED`  
실패 시 `FAILED` (재시도 예약) → 최대 시도 초과 시 `DEAD`

---

## 기술 스택

| Layer | Stack | 선택 이유 |
|-------|-------|-----------|
| Backend | NestJS + TypeScript | 모듈 구조, DI, Guard로 Auth/API Key 분리에 적합 |
| DB | PostgreSQL + Prisma | 관계형 데이터·트랜잭션·마이그레이션 |
| Queue | Redis + BullMQ | 지연 재시도(delay), Worker 분리, jobId로 중복 enqueue 방지 |
| Frontend | Next.js (App Router) | 대시보드 SSR/CSR 혼용과 빠른 프로토타이핑 |
| Deploy | Docker Compose + Nginx | 로컬/포트폴리오 데모 재현성 |

---

## 핵심 API 명세

### Auth
- `POST /api/auth/register` `{ email, password, name }`
- `POST /api/auth/login` `{ email, password }` → `{ accessToken, user }` (200)
- `POST /api/auth/demo` → 데모 계정 + 샘플 프로젝트 (non-production)
- `GET /api/auth/me` (Bearer JWT)

### Projects
- `GET/POST /api/projects`
- `GET/PATCH/DELETE /api/projects/:id`
- `POST /api/projects/:id/api-keys` → raw key는 **한 번만** 반환
- `DELETE /api/projects/:id/api-keys/:keyId`

### Endpoints
- `GET/POST /api/projects/:id/endpoints`
- `PATCH/DELETE /api/projects/:id/endpoints/:endpointId`
- `POST .../rotate-secret`

### Events (ingestion)
- `POST /api/v1/events` — header `X-API-Key: hp_...`
  ```json
  {
    "endpointId": "...",
    "eventType": "order.created",
    "payload": { "orderId": "ord_1" },
    "idempotencyKey": "ord_1"
  }
  ```
- Dashboard: `POST /api/projects/:id/events` (JWT)
- `GET /api/projects/:id/events`
- `GET /api/projects/:id/events/:eventId`
- `POST /api/projects/:id/events/:eventId/redeliver`

### Stats
- `GET /api/projects/:id/stats` — 성공률, 실패율, 평균 응답 시간

### Health
- `GET /api/health`

---

## 주요 기술 포인트

### 1. BullMQ 비동기 처리
API는 이벤트를 DB에 저장한 뒤 Queue에만 enqueue하고 즉시 응답합니다. Worker가 실제 HTTP 전송을 담당합니다.

### 2. Exponential Backoff
`delay = min(base * 2^(attempt-1), max)` 초. 기본 base 10s, max 1h. 최대 시도 횟수 초과 시 `DEAD`.

### 3. Idempotency Key
`(projectId, idempotencyKey)` unique. 동일 키 재요청 시 기존 이벤트를 반환하고 새 delivery를 만들지 않습니다.

### 4. HMAC-SHA256 서명
```
signed_payload = "{timestamp}.{rawBody}"
signature = HMAC_SHA256(endpoint.secret, signed_payload)
Header: X-HookPilot-Signature: sha256=<hex>
```

### 5. 이벤트 / Delivery 분리
재시도·수동 재전송마다 delivery row가 쌓이므로, 실패 원인을 시도 단위로 추적할 수 있습니다.

---

## 로컬 실행

### 사전 요구
- Node.js 20+
- Docker (PostgreSQL, Redis)

> 호스트 포트: Postgres `5435`, Redis `6382` (다른 로컬 DB/Redis와 충돌 방지)

```bash
# 1) 인프라
cp .env.example .env
cp .env.example apps/api/.env
docker compose up -d

# 2) 의존성 & 마이그레이션
npm install
cd apps/api && npx prisma migrate dev && npx prisma generate && cd ../..

# 3) API (port 3001)
npm run start:dev -w @hookpilot/api

# 4) Web (port 3000)
npm run dev -w @hookpilot/web
```

브라우저: [http://localhost:3000](http://localhost:3000)

로그인 화면의 **Demo로 체험하기** 버튼으로 바로 입장할 수 있습니다.  
(`POST /api/auth/demo` — `demo@hookpilot.test` 계정 + 샘플 프로젝트 `Demo Shop` 자동 준비, production에서는 비활성)

### 빠른 검증 (curl)

```bash
# 회원가입
curl -s -X POST localhost:3001/api/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"dev@hookpilot.test","password":"password123","name":"Dev"}'
```

이후 대시보드에서 Project → Endpoint → API Key → 테스트 이벤트를 보내면 Worker가 전송을 시도합니다.

---

## 실패 재시도 데모

수신 서버가 일시적으로 503을 반환하다가 복구되는 시나리오를 재현합니다.

```bash
# 터미널 1 — 처음 2번 실패 후 성공하는 수신기
npm run demo:receiver

# 터미널 2 — API는 WEBHOOK_BACKOFF_BASE_SECONDS=2 권장 (apps/api/.env)
npm run demo:retry
```

예상 타임라인 (base=2s):

1. attempt #1 → HTTP 503 (FAILED), +2s 후 재시도  
2. attempt #2 → HTTP 503 (FAILED), +4s 후 재시도  
3. attempt #3 → HTTP 200 (SUCCESS) → event `DELIVERED`

대시보드 Event Detail에서도 delivery 이력이 시도 단위로 쌓인 것을 확인할 수 있습니다.

---

## Postman Collection

로컬 v3 collection이 `postman/collections/HookPilot API`에 있습니다.

```bash
# 스키마 검증
npm run postman:lint

# 컬렉션 실행 (Local environment)
npm run postman:run
```

권장 순서: **Health → Register/Login → Create project → Create endpoint → Create API key → Ingest event → (wait) Get event detail → Stats**

Environment: `postman/environments/Local.environment.yaml`  
Login/Register 스크립트가 `access_token`을, Create 요청들이 `project_id` / `endpoint_id` / `api_key` / `event_id`를 자동 저장합니다.

---

## 테스트

```bash
cd apps/api && npm test
```

포함 내용:
- HMAC / API Key / Exponential Backoff 유틸 유닛 테스트
- `scripts/demo-retry.mjs` E2E 재시도 데모
- Postman collection tests (`npm run postman:run`)

---

## 디렉터리 구조

```
hookpilot/
├── apps/
│   ├── api/          # NestJS + Prisma + BullMQ Worker
│   └── web/          # Next.js Dashboard
├── postman/
│   ├── collections/HookPilot API/
│   └── environments/Local.environment.yaml
├── scripts/
│   ├── failing-receiver.mjs
│   └── demo-retry.mjs
├── docker-compose.yml
├── nginx/
└── README.md
```

---

## 포트폴리오 어필

단순히 CRUD API가 아니라:

1. **비동기 시스템** — API / Queue / Worker 책임 분리  
2. **장애 대응** — 재시도 정책과 Dead letter  
3. **데이터 정합성** — Idempotency + Event/Delivery 모델  
4. **보안** — API Key hashing, JWT, HMAC 서명  

을 설계·구현했음을 보여주는 프로젝트입니다.
