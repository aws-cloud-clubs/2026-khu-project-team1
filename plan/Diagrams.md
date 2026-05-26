# 웹훅 인스펙터 Diagrams

## Overview

이 문서는 웹훅 인스펙터 시스템의 5종 Mermaid 다이어그램을 포함한다.
각 다이어그램은 ArchSpec(MOD/EXT/Deployment), APISpec(Endpoints/Scenarios), TechSpec(Data Models)을 기반으로 생성되었다.

| 다이어그램 | 타입 | 근거 문서 |
|-----------|------|---------|
| System Architecture | graph TD | ArchSpec Modules + Module Dependencies |
| API Sequence | sequenceDiagram | APISpec Endpoints + ArchSpec Data Flow Scenarios |
| Data Model (ERD) | erDiagram | TechSpec Data Models (DM-001~DM-003) |
| Pipeline Flow | flowchart TD | ArchSpec Data Flow Scenario 1 |
| Deployment Topology | graph LR | ArchSpec Deployment Topology |

---

## System Architecture

ArchSpec의 6개 모듈(MOD-001~MOD-006)과 외부 시스템(EXT-001, EXT-003, EXT-004, EXT-006 Supabase)을
Auth / Ingestion / Realtime 3개 도메인으로 subgraph 그룹화했다.
동기 호출(`-->`)과 비동기 이벤트(`-.->`)를 구분하여 표시한다.

```mermaid
graph TD
    Client[Client Browser]
    ExtWebhook[External Webhook Service]
    Supabase["Supabase Auth (EXT-006)"]

    subgraph "Auth Domain"
        MOD1["AuthModule (MOD-001) - JWT 검증"]
        MOD2["UrlModule (MOD-002)"]
    end

    subgraph "Ingestion Domain"
        MOD3["IngestionController (MOD-003)"]
        MOD4["WorkerService (MOD-004)"]
    end

    subgraph "Realtime Domain"
        MOD5["WebSocketHandler (MOD-005)"]
        MOD6["PushSender (MOD-006)"]
    end

    subgraph "External Systems"
        EXT1["ALB WebSocket / SimpMessaging (EXT-001)"]
        EXT3["AWS SQS (EXT-003)"]
        EXT4["AWS DynamoDB (EXT-004)"]
    end

    Client --> Supabase
    Supabase --> Client
    Client --> MOD1
    MOD1 --> MOD2
    MOD2 --> EXT4
    Client --> MOD3
    ExtWebhook --> MOD3

    MOD3 --> EXT4
    MOD3 -.-> EXT3
    MOD4 -.-> EXT3
    MOD4 --> EXT4
    MOD4 --> MOD6
    MOD5 --> EXT4
    MOD6 --> EXT4
    MOD6 -.-> EXT1
    EXT1 -.-> Client
```

---

## API Sequence

ArchSpec의 2개 핵심 시나리오를 시퀀스 다이어그램으로 표현한다.
- **Scenario 0**: 사용자 인증 + 웹훅 URL 최초 발급 (Supabase 로그인 → URL-001)
- **Scenario 1**: 웹훅 수신 + 실시간 대시보드 Push (WEBHOOK-001)

```mermaid
sequenceDiagram
    participant C as Client
    participant SB as Supabase Auth (EXT-006)
    participant Auth as AuthModule (MOD-001)
    participant Url as UrlModule (MOD-002)
    participant Ingest as IngestionController (MOD-003)
    participant Worker as WorkerService (MOD-004)
    participant Push as PushSender (MOD-006)
    participant SQS as AWS SQS (EXT-003)
    participant DB as DynamoDB (EXT-004)
    participant WS as ALB WebSocket / SimpMessaging (EXT-001)
    participant ExtWebhook as External Webhook Service

    Note over C,SB: Scenario 0 - 사용자 인증 (Supabase)
    C->>SB: signInWithPassword(email, password)
    SB-->>C: { access_token (JWT HS256), refresh_token }

    Note over C,Url: Scenario 0 - 웹훅 URL lazy 발급 (URL-001)
    C->>Auth: GET /v1/webhook-url, Authorization Bearer JWT
    Auth->>Auth: JWT 서명 검증 (SUPABASE_JWT_SECRET), sub 추출
    Auth->>Url: supabase_uid 전달
    Url->>DB: GetItem User by PK USER#{supabase_uid}
    alt User 미존재
        Url->>DB: PutItem User (UUID v4 생성)
    end
    Url-->>C: 200 { webhook_url, uuid, is_active }

    Note over ExtWebhook,WS: Scenario 1 - 웹훅 수신 + 실시간 Push (WEBHOOK-001)
    ExtWebhook->>Ingest: POST /{uuid}
    Ingest->>DB: GSI-webhookUuid 조회 uuid to user_id
    DB-->>Ingest: user_id, is_active
    Ingest->>SQS: enqueue EVT-001
    Ingest-->>ExtWebhook: 200 { message_id, status received }
    SQS->>Worker: @SqsListener EVT-001
    Worker->>DB: PutItem WebhookEvent (DM-002), TTL +30일
    Worker->>Push: pushEvent(user_id, webhook_event)
    Push->>DB: Query GSI-userId-connection (DM-003)
    DB-->>Push: connection_id
    Push->>WS: SimpMessagingTemplate.convertAndSendToUser
    WS-->>C: STOMP WebSocket MESSAGE EVT-003
```

---

## Data Model (ERD)

TechSpec의 3개 Data Model(DM-001~DM-003)을 ERD로 표현한다.
DynamoDB 단일 테이블 설계이므로 엔티티 간 관계는 논리적 FK 참조를 의미한다.
USER 엔티티의 `user_id`는 Supabase Auth가 발급한 UID이며, 이메일·비밀번호 해시는 Supabase가 관리하므로 본 테이블에는 저장하지 않는다.

```mermaid
erDiagram
    USER ||--o{ WEBHOOKEVENT : "owns"
    USER ||--o{ WSCONNECTION : "connects via"

    USER {
        uuid user_id PK
        uuid webhook_uuid
        boolean is_active
        string created_at
    }

    WEBHOOKEVENT {
        uuid id PK
        uuid user_id FK
        string received_at
        string method
        string path
        string headers
        string body
        string content_type
        string source_ip
        number ttl
    }

    WSCONNECTION {
        string connection_id PK
        uuid user_id FK
        string connected_at
        number ttl
    }
```

---

## Pipeline Flow

ArchSpec Scenario 1(웹훅 수신 → 저장 → 실시간 시각화)을 flowchart로 표현한다.

```mermaid
flowchart TD
    Start([외부 웹훅 POST 수신]) --> ValidUUID{UUID 유효?}
    ValidUUID -->|유효 + 활성| EnqueueSQS["SQS Main Queue enqueue (EVT-001)"]
    ValidUUID -->|무효 or 비활성| Return4xx[4xx 응답 반환]

    EnqueueSQS --> Return200[200 OK 즉시 응답]
    EnqueueSQS -.->|@SqsListener| WorkerConsume["WorkerService 소비 (MOD-004)"]

    WorkerConsume --> SaveEvent["DynamoDB 저장 WebhookEvent (DM-002), TTL +30일"]
    SaveEvent --> PushWS["WebSocket Push EVT-003 via MOD-006"]
    PushWS --> Done([실시간 대시보드 표시 완료])
```

---

## Deployment Topology

ArchSpec Deployment Topology 섹션의 모든 배포 단위를 AWS 인프라 경계별 subgraph로 표현한다.
Supabase Auth는 외부 SaaS이므로 AWS 외부에 별도 배치한다.

```mermaid
graph LR
    subgraph "Client Layer"
        Browser[Browser Dashboard]
        ExtWebhookSvc[External Webhook Service]
    end

    subgraph "External SaaS"
        SupabaseAuth["Supabase Auth\nJWT HS256 발급"]
    end

    subgraph "AWS CDN"
        CF[CloudFront]
        S3["S3 s3-dashboard"]
    end

    subgraph "AWS Load Balancer"
        ALB["alb-main\nALB + sticky session"]
    end

    subgraph "AWS Compute — Auto Scaling Group"
        EC2a["EC2 Instance 1\nSpring Boot 3.x / Java 21\nt3.micro"]
        EC2b["EC2 Instance 2\nSpring Boot 3.x / Java 21\nt3.micro"]
    end

    subgraph "AWS Queue"
        SQSMain["sqs-main\nSQS Standard"]
    end

    subgraph "AWS Storage"
        DynamoDB[("dynamodb-main")]
    end

    subgraph "AWS Monitoring"
        CW["cloudwatch-dash\nMetrics + CloudWatch Agent"]
    end

    Browser --> SupabaseAuth
    Browser --> CF
    CF --> S3
    Browser --> ALB
    ExtWebhookSvc --> ALB

    ALB --> EC2a
    ALB --> EC2b

    EC2a -->|enqueue| SQSMain
    EC2b -->|enqueue| SQSMain
    SQSMain -->|@SqsListener poll| EC2a
    SQSMain -->|@SqsListener poll| EC2b
    EC2a --> DynamoDB
    EC2b --> DynamoDB
    EC2a --> CW
    EC2b --> CW
```
