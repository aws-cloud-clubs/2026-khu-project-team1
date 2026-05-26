# 웹훅 인스펙터 Architecture Spec

## Overview

웹훅 인스펙터는 **Event-Driven + Layered 혼합 아키텍처**를 채택한다. 외부 웹훅 수신 경로는 완전 비동기(SQS 기반)로, 사용자 대시보드 API 경로는 동기 호출로 처리하여 두 트래픽 유형을 논리적으로 분리한다. IngestionController / WorkerService를 분리하여 외부 서비스에 즉각적인 200 응답을 보장하면서 내부 처리(저장·Push)를 독립적으로 확장한다.

도메인 경계는 **인증(Auth) / 수신(Ingestion) / 실시간(Realtime)** 3개로 분리된다. 인증 도메인은 **Supabase Auth**(외부 SaaS)에 회원가입·로그인·JWT 발급을 위임하며, Spring Boot 백엔드는 JWT 검증 및 User-Webhook URL 매핑만 담당한다. 모든 도메인 데이터는 단일 DynamoDB 테이블 구조(PK/SK 설계)에 저장되어 EC2 Auto Scaling 기반 수평 확장과 호환된다. WebSocket 세션은 ALB sticky session으로 인스턴스 친화성을 보장하며, 세션 메타데이터는 DynamoDB에 저장한다.

## Modules

| ID      | Name                | Responsibility                                                    | Implements (CMP-ID) |
|---------|---------------------|-------------------------------------------------------------------|---------------------|
| MOD-001 | AuthModule          | Supabase JWT 검증 필터, SecurityContext에 supabase_uid 등록         | CMP-001             |
| MOD-002 | UrlModule           | User 레코드 lazy 생성, UUID 웹훅 URL 발급, 활성화/비활성화 관리      | CMP-001             |
| MOD-003 | IngestionController | 웹훅 HTTP 수신, UUID 검증, SQS 적재, 200 응답                       | CMP-002             |
| MOD-004 | WorkerService       | SQS @SqsListener 소비, DynamoDB 저장, Push 발동                    | CMP-002             |
| MOD-005 | WebSocketHandler    | WebSocket 연결·해제 처리, DynamoDB 세션 저장                         | CMP-003             |
| MOD-006 | PushSender          | 사용자 WebSocket 채널로 신규 이벤트 Push                             | CMP-003             |

### MOD-001: AuthModule

**책임:**
- `Authorization: Bearer {token}` 헤더에서 Supabase JWT 추출
- Supabase JWT Secret(`SUPABASE_JWT_SECRET`)으로 서명 검증 (HS256)
- 페이로드의 `sub` 클레임을 `supabase_uid`로 추출하여 `SecurityContextHolder`에 등록
- 검증 실패 시 401 반환

**구현 형태:** Spring Security `OncePerRequestFilter` 기반 `JwtVerificationFilter`

> ⚠️ 회원가입·로그인·refresh 토큰 발급은 프론트엔드가 Supabase JS SDK로 직접 처리하며, 본 모듈은 백엔드 측 JWT 검증만 담당한다.

### MOD-002: UrlModule

**책임:**
- `GET /v1/webhook-url` 최초 호출 시 DynamoDB User 레코드 lazy 생성
  - User 레코드 없으면 → UUID v4 생성 + `user_id`(supabase_uid), `webhook_uuid`, `is_active=true`, `created_at` 저장
  - 있으면 → 기존 `webhook_uuid` 반환
- `PATCH /v1/webhook-url`로 `is_active` 토글
- IngestionController(MOD-003)가 UUID로 User 조회 시 `is_active` 함께 반환

### MOD-003: IngestionController

**책임:**
- `POST /{uuid}` 요청을 ALB가 Spring MVC `@RestController`로 전달
- UUID 유효성 확인 (DynamoDB `GSI-webhookUuid` 조회)
- 원본 headers + body + meta를 SQS Main Queue에 enqueue
- 외부 서비스에 즉시 `200 OK` 반환 (지연 없음)

**주요 기능:**
- receiveWebhook(uuid, HttpServletRequest) → ResponseEntity 200
- validateUUID(uuid) → { user_id, is_active }
- enqueueToSQS(webhookData) → { message_id }

**의존 모듈:** MOD-002 (UUID 검증을 위해 UrlModule의 데이터 조회)

### MOD-004: WorkerService

**책임:**
- SQS Main Queue를 `@SqsListener`로 메시지 소비 (배치 최대 10개)
- DynamoDB에 WebhookEvent 저장 (TTL: 현재 시각 + 30일)
- CMP-003(RealtimeService)를 통해 해당 사용자 WebSocket 채널에 Push

**의존 모듈:** MOD-006 (Push 전송)

### MOD-005: WebSocketHandler

**책임:**
- WebSocket 연결 시 JWT 검증 후 DynamoDB `WsConnection` 저장 (TTL: 현재 시각 + 24h)
- 연결 해제 시 DynamoDB 레코드 삭제
- 사용자당 최대 3개 동시 연결 제한

### MOD-006: PushSender

**책임:**
- DynamoDB `GSI-userId-connection`으로 사용자의 활성 `connection_id` 조회
- `SimpMessagingTemplate.convertAndSendToUser(userId, "/queue/webhooks", payload)` 호출
- ALB sticky session으로 동일 인스턴스 내 세션에 직접 접근

## Module Dependencies

| From         | To           | Type         | Purpose                                                       |
|--------------|--------------|--------------|---------------------------------------------------------------|
| Client       | Supabase     | sync call    | 회원가입, 로그인, 토큰 갱신 요청 (Supabase JS SDK 경유)        |
| Client       | MOD-001      | sync call    | API 요청 시 JWT 헤더로 인증 (모든 보호 엔드포인트 진입점)      |
| Client       | MOD-002      | sync call    | 웹훅 URL 조회, 비활성화 요청 (GET/PATCH /v1/webhook-url)      |
| Client       | MOD-003      | sync call    | 웹훅 이력 조회 요청 (GET /v1/webhooks)                         |
| ExtWebhook   | MOD-003      | sync call    | 외부 서비스 웹훅 POST                                         |
| MOD-001      | EXT-006      | sync call    | Supabase JWT Secret으로 서명 검증 (오프라인, 네트워크 호출 없음) |
| MOD-002      | EXT-004      | sync call    | DynamoDB User 레코드 조회/생성 (DM-001)                        |
| MOD-003      | EXT-003      | async event  | 웹훅 데이터 SQS Main Queue enqueue (EVT-001)                  |
| MOD-004      | EXT-003      | read         | SQS 메시지 소비 (@SqsListener)                               |
| MOD-004      | EXT-004      | sync call    | WebhookEvent DynamoDB 저장                                    |
| MOD-004      | MOD-006      | sync call    | 신규 이벤트 WebSocket Push 요청                               |
| MOD-005      | EXT-004      | sync call    | WebSocket 세션 DynamoDB 저장/조회                             |
| MOD-006      | EXT-001      | sync call    | WebSocket Push 메시지 전송 (SimpMessagingTemplate)           |

**EXT 참조 (TechSpec DEP 매핑):**

| EXT-ID  | TechSpec DEP | 서비스명                        |
|---------|--------------|---------------------------------|
| EXT-001 | DEP-001      | AWS ALB (WebSocket sticky session) |
| EXT-002 | DEP-001      | AWS ALB (REST / HTTP)           |
| EXT-003 | DEP-003      | AWS SQS                         |
| EXT-004 | DEP-004      | AWS DynamoDB                    |
| EXT-005 | DEP-006      | AWS CloudWatch                  |
| EXT-006 | DEP-005      | Supabase Auth                   |

## Events

| ID      | Producer | Consumer  | Payload                                                                              |
|---------|----------|-----------|--------------------------------------------------------------------------------------|
| EVT-001 | MOD-003  | MOD-004   | { webhook_id, user_id, uuid, method, headers, body, content_type, source_ip, received_at } |
| EVT-003 | MOD-006  | Client    | { type: "NEW_WEBHOOK", webhook_id, user_id, method, received_at, content_type }     |

### EVT-001: WebhookReceived

SQS Main Queue를 통해 전달. IngestionController(MOD-003)가 생성하고 WorkerService(MOD-004)가 `@SqsListener`로 소비한다. 원본 요청의 모든 정보를 포함하여 Worker가 저장·Push를 수행할 수 있도록 한다.

**SQS 메시지 속성:**
- Queue Type: Standard (FIFO 미사용)
- MessageBody: EVT-001 payload JSON

### EVT-003: WebhookPushed

Spring WebSocket `SimpMessagingTemplate`을 통해 사용자의 연결된 브라우저에 전송. PushSender(MOD-006)가 DynamoDB의 WsConnection 테이블에서 해당 user_id의 connection_id를 조회한 뒤 STOMP 메시지를 전달한다. ALB sticky session으로 동일 인스턴스 내 세션에 직접 접근한다.

## Data Flow

### Scenario 0: 사용자 인증 + 웹훅 URL 최초 발급 (FR-001 핵심 흐름)

| Step | From    | To       | Data                                                              |
|------|---------|----------|-------------------------------------------------------------------|
| 1    | Client  | Supabase | signUp / signInWithPassword (이메일/비밀번호)                     |
| 2    | Supabase| Client   | { access_token (JWT, HS256, sub=supabase_uid), refresh_token }    |
| 3    | Client  | MOD-001  | GET /v1/webhook-url, Authorization: Bearer {access_token}         |
| 4    | MOD-001 | MOD-001  | JWT 서명 검증 (SUPABASE_JWT_SECRET), sub 클레임 추출              |
| 5    | MOD-001 | MOD-002  | supabase_uid 전달                                                 |
| 6    | MOD-002 | EXT-004  | DynamoDB GetItem: PK=USER#{supabase_uid}                          |
| 7    | MOD-002 | EXT-004  | 미존재 시 → UUID v4 생성, PutItem User(DM-001)                    |
| 8    | MOD-002 | Client   | { webhook_url, uuid, is_active, created_at }                      |

이후 요청은 동일하게 `Authorization: Bearer {access_token}` 헤더를 포함한다. 토큰 만료 시 프론트엔드 Supabase SDK가 자동으로 refresh_token으로 갱신한다.

### Scenario 1: 외부 서비스 → 웹훅 수신 → 실시간 시각화

| Step | From       | To         | Data                                                              |
|------|------------|------------|-------------------------------------------------------------------|
| 1    | ExtWebhook | MOD-003    | HTTP POST /{uuid}, headers, body (ALB → EC2 IngestionController) |
| 2    | MOD-003    | EXT-004    | DynamoDB GSI-webhookUuid 조회: uuid → user_id, is_active          |
| 3    | MOD-003    | EXT-003    | SQS enqueue EVT-001 (전체 webhook data)                           |
| 4    | MOD-003    | ExtWebhook | HTTP 200 OK (즉시 응답)                                           |
| 5    | EXT-003    | MOD-004    | @SqsListener 트리거 (EVT-001 소비)                                |
| 6    | MOD-004    | EXT-004    | DynamoDB PutItem: WebhookEvent 저장 (DM-002), TTL = +30일         |
| 7    | MOD-004    | MOD-006    | pushEvent(user_id, webhook_event)                                 |
| 8    | MOD-006    | EXT-004    | DynamoDB Query: GSI-userId-connection (DM-003) → connection_id    |
| 9    | MOD-006    | EXT-001    | SimpMessagingTemplate.convertAndSendToUser: EVT-003 payload       |
| 10   | EXT-001    | Client     | STOMP WebSocket message (브라우저 대시보드 실시간 표시)            |

## Deployment Topology

| Component              | Unit            | Infrastructure                                                              |
|------------------------|-----------------|-----------------------------------------------------------------------------|
| 인증 제공자            | supabase-auth   | Supabase Auth (외부 SaaS, JWT HS256)                                        |
| 로드 밸런서            | alb-main        | AWS ALB (HTTP + WebSocket, sticky session duration 1일, TLS 1.2+)           |
| 애플리케이션 서버      | ec2-asg         | AWS EC2 Auto Scaling Group — t3.micro, Java 21 / Spring Boot 3.x, min 2 / max 10 |
| Main Queue             | sqs-main        | AWS SQS Standard Queue (visibilityTimeout: 30s, Long Polling 20s)           |
| Data Store             | dynamodb-main   | AWS DynamoDB on-demand (단일 테이블 설계)                                    |
| Static Dashboard       | s3-dashboard    | AWS S3 + CloudFront (React 빌드 결과물, OAC 기반 보안)                       |
| Monitoring             | cloudwatch-dash | AWS CloudWatch Metrics + Dashboard + CloudWatch Agent (EC2 CPU·메모리)      |

**네트워크 설계:**
- EC2 Auto Scaling Group은 VPC Public Subnet(2개 AZ)에 배포, ALB 뒤에 위치
- 외부 트래픽은 ALB HTTPS(TLS 1.2+)만 허용; EC2 Security Group(`sg-ec2`)은 ALB Security Group(`sg-alb`)에서 오는 트래픽만 허용
- DynamoDB, SQS는 퍼블릭 엔드포인트로 접근 (선택적으로 VPC Endpoint 적용 가능)
- Supabase Auth는 외부 SaaS로 HTTPS를 통해 통신
- CloudWatch Agent가 각 EC2 인스턴스에 설치되어 CPU, 메모리, JVM heap 지표 수집

**도메인 구조:**
- `api.hook.example.com` → ALB (REST API + WebSocket, 경로로 구분)
- `hook.example.com` → ALB (외부 서비스 웹훅 수신)
- `dashboard.hook.example.com` → CloudFront (React 대시보드)

**인프라 프로비저닝:** AWS 콘솔에서 직접 리소스 생성 (IaC 도구 미사용).
