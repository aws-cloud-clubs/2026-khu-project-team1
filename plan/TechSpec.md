# 웹훅 인스펙터 Tech Spec

## Overview

웹훅 인스펙터는 AWS EC2 기반 서비스 아키텍처로 구현되는 백엔드 디버깅 플랫폼이다. ALB(Application Load Balancer) 하나가 웹훅 수신·대시보드 REST·WebSocket 트래픽을 EC2 Auto Scaling Group(Java 21 / Spring Boot 3.x, t3.micro)으로 라우팅하며, SQS를 중간 버퍼로 하는 비동기 처리 파이프라인이 핵심이다. 수신된 웹훅은 즉시 큐에 적재되어 외부 서비스에 빠른 응답을 보장하고, WorkerService가 `@SqsListener`로 비동기 소비하여 저장·실시간 Push를 처리한다.

사용자 인증은 **Supabase Auth**에 완전 위임한다. 회원가입·로그인·토큰 갱신은 프론트엔드에서 Supabase JS SDK로 직접 처리하며, Spring Boot 백엔드는 Supabase가 발급한 JWT(HS256)를 검증하여 `user_id`(Supabase UID)를 추출하는 역할만 수행한다. 웹훅 수신 URL은 UUID v4로 생성된 경로 파라미터로 식별한다. 실시간 시각화는 Spring WebSocket(STOMP)을 통해 구현한다. 모든 도메인 데이터는 DynamoDB에 저장되어 EC2 Auto Scaling 기반 수평 확장과 호환된다. 인증 정보(이메일·비밀번호 해시)는 DynamoDB에 저장하지 않으며, Supabase가 관리한다.

## Components

| ID      | Name                  | Responsibility                                                | Implements (FR-ID)    |
|---------|-----------------------|---------------------------------------------------------------|-----------------------|
| CMP-001 | AuthService           | Supabase JWT 검증, User 레코드 lazy 생성, UUID 웹훅 URL 발급/관리 | FR-001                |
| CMP-002 | IngestionService      | 웹훅 HTTP 수신, SQS 적재, DB 저장                              | FR-001, FR-002        |
| CMP-003 | RealtimeService       | WebSocket 연결 관리, 신규 이벤트 브라우저 Push                  | FR-002                |

### CMP-001: AuthService

**책임:**
- Supabase가 발급한 JWT(HS256) 서명 검증 (`SUPABASE_JWT_SECRET` 사용)
- JWT `sub` 클레임 → `supabase_uid`(=`user_id`) 추출
- `GET /v1/webhook-url` 최초 호출 시 DynamoDB User 레코드 lazy 생성 + UUID v4 웹훅 URL 자동 발급
- 웹훅 URL 활성화/비활성화 토글

> ⚠️ 회원가입·로그인·비밀번호 관리·refresh 토큰 발급은 **Supabase Auth가 담당**하며 본 컴포넌트에서 구현하지 않는다.

**주요 인터페이스:**

| Method              | Inputs                       | Outputs                                |
|---------------------|------------------------------|----------------------------------------|
| verifyJwt()         | access_token (Supabase JWT)  | supabase_uid, valid: boolean           |
| getOrCreateUser()   | supabase_uid                 | User { user_id, webhook_uuid, is_active } |
| getWebhookUrl()     | supabase_uid                 | webhook_url (string)                   |
| deactivateUrl()     | supabase_uid, is_active      | success: boolean                       |

**의존성:** DEP-004 (DynamoDB), DEP-005 (Supabase Auth)

### CMP-002: IngestionService

**책임:**
- `POST /{uuid}` 수신 및 UUID 유효성 검증 (DynamoDB GSI 조회)
- 원본 헤더·바디 전체를 SQS 메인 큐에 즉시 적재
- WorkerService에서 DynamoDB에 WebhookEvent 저장
- Content-Type 파싱 없이 raw body + headers 보존

**주요 인터페이스:**

| Method           | Inputs                                          | Outputs                        |
|------------------|-------------------------------------------------|--------------------------------|
| receiveWebhook() | uuid, method, headers, body, content_type       | { message_id, status: 200 }    |
| processEvent()   | SQS message (webhook data)                      | { webhook_id, saved: true }    |
| listHistory()    | user_id, limit, offset                          | WebhookEvent[]                 |
| getDetail()      | webhook_id, user_id                             | WebhookEvent                   |

**의존성:** DEP-001 (ALB), DEP-002 (EC2/Spring Boot), DEP-003 (SQS), DEP-004 (DynamoDB)

### CMP-003: RealtimeService

**책임:**
- 사용자별 WebSocket 연결 세션 관리 (연결/해제)
- 신규 WebhookEvent 저장 직후 해당 사용자의 연결에 Push
- ALB sticky session으로 동일 사용자의 WebSocket 연결이 동일 EC2 인스턴스로 라우팅됨을 보장

**주요 인터페이스:**

| Method         | Inputs                      | Outputs                   |
|----------------|-----------------------------|---------------------------|
| onConnect()    | connection_id, user_id      | { stored: true }          |
| onDisconnect() | connection_id               | { removed: true }         |
| pushEvent()    | user_id, webhook_event      | { delivered: boolean }    |

**의존성:** DEP-001 (ALB), DEP-002 (EC2/Spring Boot), DEP-004 (DynamoDB)

## Data Models

| ID     | Name             | Key Fields                                                                           |
|--------|------------------|--------------------------------------------------------------------------------------|
| DM-001 | User             | user_id (= Supabase UID), webhook_uuid, is_active, created_at                       |
| DM-002 | WebhookEvent     | id (UUID), user_id, received_at, method, path, headers (JSON), body (string), content_type, source_ip, ttl |
| DM-003 | WsConnection     | connection_id, user_id, connected_at, ttl (24h)                                      |

### DM-001: User

| Field         | Type      | Required | Description                                              |
|---------------|-----------|----------|----------------------------------------------------------|
| user_id       | UUID      | yes      | Supabase Auth UID. DynamoDB Partition Key                |
| webhook_uuid  | UUID v4   | yes      | 수신 URL 경로 파라미터 (`/{this}`). GSI로 조회            |
| is_active     | boolean   | yes      | URL 활성 여부 (false시 4xx 응답)                          |
| created_at    | ISO8601   | yes      | User 레코드 생성 시각 (첫 로그인 시점)                    |

> ⚠️ 이메일·비밀번호 해시는 Supabase가 관리하며 DynamoDB에 저장하지 않는다.

### DM-002: WebhookEvent

| Field        | Type      | Required | Description                                      |
|--------------|-----------|----------|--------------------------------------------------|
| id           | UUID v4   | yes      | 이벤트 고유 식별자. DynamoDB PK                    |
| user_id      | UUID      | yes      | 소유 사용자 (Supabase UID). GSI로 사용자별 조회   |
| received_at  | ISO8601   | yes      | 수신 시각 (Sort Key for user query)               |
| method       | string    | yes      | HTTP 메서드 (POST, PUT 등)                        |
| path         | string    | yes      | 요청 경로                                         |
| headers      | JSON      | yes      | 요청 헤더 전체 (key-value 맵)                     |
| body         | string    | yes      | raw body. JSON이면 그대로, binary면 base64         |
| content_type | string    | yes      | Content-Type 헤더 값                              |
| source_ip    | string    | yes      | 발신자 IP                                         |
| ttl          | number    | yes      | Unix timestamp (현재 + 30일), DynamoDB TTL 자동 삭제 |

### DM-003: WsConnection

| Field         | Type    | Required | Description                                |
|---------------|---------|----------|--------------------------------------------|
| connection_id | string  | yes      | WebSocket 연결 ID. DynamoDB PK             |
| user_id       | UUID    | yes      | Supabase UID. GSI로 사용자별 조회          |
| connected_at  | ISO8601 | yes      | 연결 시각                                  |
| ttl           | number  | yes      | Unix timestamp (현재 + 24h), 자동 삭제     |

## External Dependencies

| ID      | Service                               | Purpose                                                                     | Used by (CMP-ID)          |
|---------|---------------------------------------|-----------------------------------------------------------------------------|---------------------------|
| DEP-001 | AWS ALB (Application Load Balancer)   | 웹훅 수신·대시보드 REST·WebSocket 트래픽 라우팅, sticky session 지원           | CMP-001, CMP-002, CMP-003 |
| DEP-002 | AWS EC2 Auto Scaling Group            | Spring Boot 3.x 애플리케이션 실행 환경 (t3.micro, min 2 / max 10)             | CMP-001, CMP-002, CMP-003 |
| DEP-003 | AWS SQS (Standard Queue)             | 웹훅 비동기 처리 큐 (Main Queue)                                              | CMP-002                   |
| DEP-004 | AWS DynamoDB                          | 도메인 데이터 영속 저장 (User, WebhookEvent, WsConnection)                    | CMP-001, CMP-002, CMP-003 |
| DEP-005 | Supabase Auth                         | 회원가입·로그인·토큰 발급/갱신, JWT(HS256) 발급. 백엔드는 JWT 검증만 수행      | CMP-001                   |
| DEP-006 | AWS CloudWatch + CloudWatch Agent     | EC2 인스턴스 지표(CPU·메모리), 애플리케이션 지연 모니터링                       | CMP-002                   |
| DEP-007 | Spring Boot 3.x + Spring Cloud AWS 3.x| 웹 프레임워크, @SqsListener, DynamoDB SDK v2 통합, Spring WebSocket(STOMP)    | CMP-001, CMP-002, CMP-003 |
| DEP-008 | AWS S3 + CloudFront                   | React 대시보드 정적 호스팅 (S3 OAC + CloudFront HTTPS 배포)                  | -                         |

> 이전 버전의 `JJWT`, `BCryptPasswordEncoder` 의존성은 제거되었다. Supabase Auth가 JWT 발급 및 비밀번호 해싱을 담당한다. JWT **검증**은 Spring 백엔드가 `SUPABASE_JWT_SECRET`을 이용하여 직접 수행하며, 표준 JWT 라이브러리(예: `nimbus-jose-jwt` 또는 `jjwt`)를 사용할 수 있다.

## Technology Stack

### Backend (EC2 / Spring Boot)
- 언어/런타임: Java 21 LTS
- 프레임워크: Spring Boot 3.x (Spring MVC, Spring WebSocket, Spring Cloud AWS 3.x)
- 빌드: Gradle
- 인증: Supabase Auth(외부) + JWT 검증 라이브러리(예: jjwt 0.12.x 또는 nimbus-jose-jwt) — 검증 전용
- 배포: AWS 콘솔 수동 세팅 (IaC 미사용)

### Frontend (Dashboard)
- 프레임워크: React 18
- 빌드: Vite
- 배포: AWS S3 + CloudFront
- 인증: `@supabase/supabase-js` SDK (회원가입·로그인·토큰 자동 갱신)
- WebSocket: STOMP.js + SockJS

### Infrastructure
- Load Balancer: AWS ALB (HTTP + WebSocket, sticky session 활성화)
- Compute: AWS EC2 Auto Scaling Group (t3.micro, min 2 / max 10, Java 21)
- Queue: AWS SQS Standard Queue (Main Queue, Long Polling 20s)
- Storage: AWS DynamoDB (on-demand capacity mode)
- Monitoring: AWS CloudWatch Metrics + Dashboard + CloudWatch Agent
- CDN/Static: AWS CloudFront + S3
- Auth Provider: Supabase Auth (외부 SaaS)

### 실시간 통신
- 방식: Spring WebSocket + STOMP over ALB (sticky session)
- 이유: EC2 다중 인스턴스 환경에서 ALB sticky session으로 사용자별 WebSocket 연결을 동일 인스턴스에 고정. Spring WebSocket은 STOMP 프로토콜로 구독/발행 모델을 지원하여 서버 측 Push 구현이 간결함

## Constraints

- 모바일 앱 미개발: 프론트엔드는 웹 대시보드(React)만 제공. React Native 또는 네이티브 모바일 앱 개발 금지. (PRD Out of Scope 준수)
- 결제·과금 로직 도입 금지: DynamoDB 사용량 추적, 과금 계산, 결제 처리 모듈 구현 금지. (PRD Out of Scope 준수)
- AWS 단일 클라우드 전용 (인증 제외): GCP, Azure, 자체 서버 배포 아키텍처 미지원. 멀티클라우드 추상화 레이어 도입 금지. 단, 인증은 Supabase(외부 SaaS)를 사용한다.
- 자체 인증 시스템 구현 금지: 회원가입·로그인·비밀번호 관리·refresh 토큰 발급 로직을 백엔드에 구현하지 않는다. 모두 Supabase Auth에 위임한다.
- EC2 인스턴스 크기: t3.micro (2 vCPU, 1 GB RAM)을 기본 단위로 사용. Auto Scaling Group의 최소 인스턴스 수는 2 이상 유지하여 스파이크 발생 시 60초 이내 복귀 조건을 충족.
- SQS Long Polling: 20초 폴링 적용하여 불필요한 API 호출 최소화.
- WebSocket Sticky Session: ALB에서 `stickiness.enabled=true` (duration 1일) 설정. 동일 사용자의 WebSocket 연결이 항상 동일 EC2 인스턴스로 라우팅되어 in-memory 세션 일관성 보장.
- DynamoDB 스캔 금지: 전체 테이블 스캔 대신 GSI를 통한 조회만 허용. 쿼리 패턴에 맞는 인덱스를 사전에 선언.
- IaC 미사용: AWS CDK·Terraform 등 IaC 도구 없이 AWS 콘솔에서 직접 리소스를 생성한다.
- 최대 동시 연결: WebSocket 연결은 사용자당 최대 3개로 제한 (브라우저 탭 수 고려).
- 수신 URL당 Retention: 수신 이벤트는 DynamoDB에 30일간 보관 후 TTL로 자동 삭제.
