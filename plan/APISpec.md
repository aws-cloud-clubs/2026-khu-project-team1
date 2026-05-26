# 웹훅 인스펙터 API Spec

## Overview

이 문서는 웹훅 인스펙터의 REST API 및 WebSocket API 전체 엔드포인트를 정의한다. 모든 트래픽은 `alb-main`(AWS ALB) 하나가 수신하여 EC2 Auto Scaling Group(Spring Boot 3.x, t3.micro)으로 라우팅한다. WebSocket은 ALB sticky session을 통해 동일 인스턴스로 연결을 고정한다.

**인증 모델:**
- 회원가입·로그인·토큰 갱신은 **Supabase Auth**(외부 SaaS)에 위임한다. 프론트엔드가 `@supabase/supabase-js` SDK로 직접 호출하며, 본 API에는 회원가입·로그인·refresh 엔드포인트가 존재하지 않는다.
- 백엔드는 Supabase가 발급한 JWT(HS256, `sub`=Supabase UID)를 검증하여 보호 엔드포인트에 접근을 허용한다.

**Base URLs:**
- 대시보드 REST: `https://api.hook.example.com/v1`
- 웹훅 수신: `https://hook.example.com`
- WebSocket: `wss://api.hook.example.com/ws` (REST와 동일 도메인, 경로로 구분)

**공통 인증:** `Authorization: Bearer {supabase_access_token}` (웹훅 수신 엔드포인트 제외)

**공통 오류 응답:**

| HTTP Status | code              | 설명                          |
|-------------|-------------------|-------------------------------|
| 400         | INVALID_INPUT     | 요청 파라미터 형식 오류        |
| 401         | UNAUTHORIZED      | 토큰 없음, 만료 또는 서명 무효 |
| 403         | FORBIDDEN         | 리소스 접근 권한 없음          |
| 404         | NOT_FOUND         | 리소스 없음                    |
| 429         | RATE_LIMITED      | 요청 한도 초과                 |
| 500         | INTERNAL_ERROR    | 서버 내부 오류                 |

---

## Authentication (Supabase)

회원가입·로그인·토큰 갱신은 본 백엔드 API가 아닌 **Supabase Auth**가 처리한다. 프론트엔드 예시:

```typescript
import { supabase } from './lib/supabase'

// 회원가입
await supabase.auth.signUp({ email, password })

// 로그인
const { data } = await supabase.auth.signInWithPassword({ email, password })
const accessToken = data.session.access_token

// 백엔드 호출
fetch('/v1/webhook-url', {
  headers: { Authorization: `Bearer ${accessToken}` }
})

// 토큰 만료 자동 갱신 (SDK가 처리)
```

백엔드는 `Authorization` 헤더의 JWT를 `SUPABASE_JWT_SECRET`으로 검증하고 `sub` 클레임을 `user_id`로 사용한다.

---

## Endpoints

### URL-001: 웹훅 URL 조회 (최초 호출 시 User 레코드 lazy 생성)

**구현 컴포넌트:** CMP-001 / MOD-002  
**구현 요구사항:** FR-001

```
GET /v1/webhook-url
Authorization: Bearer {supabase_access_token}
```

**동작:** JWT에서 `sub`(Supabase UID) 추출 → DynamoDB User 조회 → 없으면 UUID v4 생성하여 lazy create → 결과 반환.

**Response 200:**
```json
{
  "webhook_url": "https://hook.example.com/f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "uuid": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "is_active": true,
  "created_at": "2026-05-25T00:00:00Z"
}
```

**Error Cases:**
- 401 UNAUTHORIZED: JWT 없음, 만료, 서명 무효

---

### URL-002: 웹훅 URL 비활성화/활성화

**구현 컴포넌트:** CMP-001 / MOD-002  
**구현 요구사항:** FR-001

```
PATCH /v1/webhook-url
Authorization: Bearer {supabase_access_token}
```

**Request Body:**

| Field     | Type    | Required | Description        |
|-----------|---------|----------|--------------------|
| is_active | boolean | Y        | true=활성, false=비활성 |

**Response 200:**
```json
{
  "uuid": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "is_active": false
}
```

**Error Cases:**
- 401 UNAUTHORIZED
- 404 NOT_FOUND: User 레코드 미존재 (URL-001 선행 호출 필요)

---

### WEBHOOK-001: 웹훅 수신

**구현 컴포넌트:** CMP-002 / MOD-003  
**구현 요구사항:** FR-001, FR-002

```
POST https://hook.example.com/{uuid}
```

**Path Parameters:**

| Parameter | Type   | Description                    |
|-----------|--------|--------------------------------|
| uuid      | string | 사용자 고유 UUID (v4 형식)      |

**Request:** 임의의 HTTP 헤더·바디 허용 (Content-Type 무관). 인증 없음 (외부 서비스에서 호출).

**Response 200:**
```json
{
  "message_id": "msg-7f83b3e7-a9b1-4f1a-8c6e-1234567890ab",
  "status": "received"
}
```

**Error Cases:**
- 404 NOT_FOUND: UUID 미등록
- 403 FORBIDDEN: URL 비활성화 상태 (is_active=false)

---

### HISTORY-001: 웹훅 이력 목록 조회

**구현 컴포넌트:** CMP-002 / MOD-003  
**구현 요구사항:** FR-002

```
GET /v1/webhooks
Authorization: Bearer {supabase_access_token}
```

**Query Parameters:**

| Parameter | Type    | Required | Default | Description              |
|-----------|---------|----------|---------|--------------------------|
| limit     | integer | N        | 20      | 페이지당 건수 (max 100)   |
| offset    | integer | N        | 0       | 조회 시작 오프셋           |

**Response 200:**
```json
{
  "total": 234,
  "limit": 20,
  "offset": 0,
  "items": [
    {
      "id": "wh-550e8400-e29b-41d4-a716-446655440001",
      "received_at": "2026-05-25T10:30:00Z",
      "method": "POST",
      "path": "/f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "content_type": "application/json",
      "body_preview": "{\"event\": \"payment.success\", ...}"
    }
  ]
}
```

---

### HISTORY-002: 웹훅 이벤트 상세 조회

**구현 컴포넌트:** CMP-002 / MOD-003  
**구현 요구사항:** FR-002

```
GET /v1/webhooks/{webhook_id}
Authorization: Bearer {supabase_access_token}
```

**Path Parameters:**

| Parameter  | Type   | Description      |
|------------|--------|------------------|
| webhook_id | string | WebhookEvent UUID |

**Response 200:**
```json
{
  "id": "wh-550e8400-e29b-41d4-a716-446655440001",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "received_at": "2026-05-25T10:30:00Z",
  "method": "POST",
  "path": "/f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "headers": {
    "content-type": "application/json",
    "x-stripe-signature": "v1=abc123...",
    "user-agent": "Stripe/1.0"
  },
  "body": "{\"event\": \"payment.success\", \"amount\": 5000}",
  "content_type": "application/json"
}
```

**Error Cases:**
- 403 FORBIDDEN: 타인의 webhook_id 접근 시도

---

## WebSocket API

### WS-001: 연결

**구현 컴포넌트:** CMP-003 / MOD-005  
**구현 요구사항:** FR-002

```
CONNECT wss://api.hook.example.com/ws
```

**Query Parameters:**

| Parameter | Type   | Required | Description                            |
|-----------|--------|----------|----------------------------------------|
| token     | string | Y        | Supabase JWT access_token              |

**동작:** 연결 시 MOD-001이 JWT 검증 후 MOD-005(WebSocketHandler)가 DynamoDB WsConnection(DM-003)에 `{ connection_id, user_id, connected_at, ttl }` 저장. ALB sticky session으로 이후 메시지가 동일 EC2 인스턴스로 라우팅됨.

**연결 실패:**
- 401: token 없음 또는 만료
- 429: 사용자당 최대 3개 연결 초과

---

### WS-002: 연결 해제

**구현 컴포넌트:** CMP-003 / MOD-005  
**구현 요구사항:** FR-002

```
DISCONNECT
```

**동작:** MOD-005가 DynamoDB에서 해당 connection_id 레코드 삭제.

---

### WS-003: 이벤트 수신 (Server → Client Push)

**구현 컴포넌트:** CMP-003 / MOD-006  
**구현 요구사항:** FR-002

```
← MESSAGE (server push)
```

**EVT-003 메시지 스키마:**
```json
{
  "type": "NEW_WEBHOOK",
  "webhook_id": "wh-550e8400-e29b-41d4-a716-446655440001",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "method": "POST",
  "received_at": "2026-05-25T10:30:00Z",
  "content_type": "application/json",
  "body_preview": "{\"event\": \"payment.success\", ...}"
}
```

**트리거:** WorkerService(MOD-004)가 WebhookEvent 저장 직후 MOD-006(PushSender) 호출 → `SimpMessagingTemplate.convertAndSendToUser(userId, "/queue/webhooks", payload)` 전송.

---

## Data Models (API 계층)

### WebhookEvent (DM-002 표현)

| Field        | Type     | Description                          |
|--------------|----------|--------------------------------------|
| id           | string   | UUID (wh- prefix)                    |
| user_id      | string   | 소유자 (Supabase UID)                |
| received_at  | datetime | ISO 8601 UTC                         |
| method       | string   | HTTP 메서드                           |
| path         | string   | 요청 경로                             |
| headers      | object   | 원본 헤더 전체 (key-value)            |
| body         | string   | 원본 바디 (string)                    |
| content_type | string   | Content-Type 헤더 값                 |

## Endpoint Summary

| ID           | Method    | Path                              | Auth     | FR         | Component |
|--------------|-----------|-----------------------------------|----------|------------|-----------|
| URL-001      | GET       | /v1/webhook-url                   | Supabase JWT  | FR-001     | CMP-001   |
| URL-002      | PATCH     | /v1/webhook-url                   | Supabase JWT  | FR-001     | CMP-001   |
| WEBHOOK-001  | POST      | /{uuid}                           | -        | FR-001,002 | CMP-002   |
| HISTORY-001  | GET       | /v1/webhooks                      | Supabase JWT  | FR-002     | CMP-002   |
| HISTORY-002  | GET       | /v1/webhooks/{webhook_id}         | Supabase JWT  | FR-002     | CMP-002   |
| WS-001       | CONNECT   | wss://api.hook.example.com/ws     | Supabase JWT  | FR-002     | CMP-003   |
| WS-002       | DISCONNECT| wss://api.hook.example.com/ws     | -        | FR-002     | CMP-003   |
| WS-003       | MESSAGE   | (server push)                     | -        | FR-002     | CMP-003   |

> 회원가입(AUTH-001), 로그인(AUTH-002), 토큰 갱신(AUTH-003) 엔드포인트는 본 API에 존재하지 않는다. 프론트엔드는 `@supabase/supabase-js` SDK로 Supabase Auth와 직접 통신한다.
