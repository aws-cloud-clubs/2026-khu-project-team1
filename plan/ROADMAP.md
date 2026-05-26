# 웹훅 인스펙터 개발 로드맵

> **프로젝트 개요:** 백엔드 개발자가 Stripe, GitHub, Slack 등 외부 서비스의 웹훅을 실시간으로 수신·검사·디버깅할 수 있는 플랫폼.  
> **스택:** Java 21 / Spring Boot 3.x · AWS EC2 Auto Scaling (t3.micro) · SQS · DynamoDB · React 18 · Supabase Auth

---

## 마일스톤 요약

| 단계 | 마일스톤 | 핵심 산출물 | 예상 기간 |
|------|----------|-------------|-----------|
| Phase 1 | 인프라 수동 세팅 | VPC, ALB, EC2 ASG, SQS, DynamoDB, S3+CloudFront 콘솔 구성 | 1주 |
| Phase 2 | 인증 & URL 발급 | Supabase Auth 연동, 웹훅 URL 발급 (FR-001) | 1주 |
| Phase 3 | 웹훅 수신 파이프라인 | IngestionController → SQS → WorkerService (FR-001, FR-002) | 1~2주 |
| Phase 4 | 실시간 대시보드 | WebSocket Push + React 프론트엔드 (FR-002) | 1~2주 |
| Phase 5 | 모니터링 & 운영 | CloudWatch 대시보드, 부하 테스트, NFR 검증 | 1주 |
| Phase 6 | 안정화 & 릴리즈 | 보안 점검, 문서화, 프로덕션 배포 | 1주 |

---

## Phase 1 · 인프라 수동 세팅

> **목표:** AWS 콘솔에서 직접 리소스를 생성하여 모든 팀원이 동일한 환경에서 개발·배포할 수 있는 기반을 만든다.  
> 각 단계 완료 후 ARN · 엔드포인트 · 이름을 팀 공유 문서에 기록한다.

### 1-1. VPC & 네트워크 구성

**VPC 생성**
- CIDR: `10.0.0.0/16`
- DNS hostnames / DNS resolution 활성화

**서브넷 생성**
- Public Subnet A: `10.0.1.0/24` (가용 영역 A)
- Public Subnet B: `10.0.2.0/24` (가용 영역 B)
- 두 서브넷 모두 `Auto-assign public IPv4 address` 활성화

**인터넷 게이트웨이**
- IGW 생성 후 VPC에 연결
- Public 서브넷 라우팅 테이블에 `0.0.0.0/0 → IGW` 경로 추가

**Security Group 생성**

| SG 이름 | 인바운드 규칙 | 용도 |
|---------|-------------|------|
| `sg-alb` | 443(HTTPS) 0.0.0.0/0, 80(HTTP) 0.0.0.0/0 | ALB |
| `sg-ec2` | 8080 소스: sg-alb만 허용 | EC2 인스턴스 |

---

### 1-2. DynamoDB 단일 테이블 생성

**AWS 콘솔 → DynamoDB → 테이블 생성**

- 테이블 이름: `webhook-inspector-main`
- Partition Key: `PK` (String)
- Sort Key: `SK` (String)
- 용량 모드: **온디맨드(On-demand)**

**GSI(Global Secondary Index) 추가**

| GSI 이름 | Partition Key | Sort Key | 용도 |
|----------|--------------|----------|------|
| `GSI-webhookUuid` | `webhook_uuid` (String) | - | UUID로 User 조회 (웹훅 수신 시) |
| `GSI-userId-receivedAt` | `user_id` (String) | `received_at` (String) | 사용자별 WebhookEvent 최신순 조회 |
| `GSI-userId-connection` | `user_id` (String) | `connection_id` (String) | 사용자별 WsConnection 조회 |

**단일 테이블 PK/SK 설계**

| 데이터 모델 | PK | SK | 비고 |
|-------------|----|----|------|
| User (DM-001) | `USER#{supabase_uid}` | `USER#{supabase_uid}` | webhookUuid GSI, Supabase UID 기반 |
| WebhookEvent (DM-002) | `WH#{webhook_id}` | `WH#{webhook_id}` | userId+receivedAt GSI, TTL 30일 |
| WsConnection (DM-003) | `WS#{connection_id}` | `WS#{connection_id}` | userId+connection GSI, TTL 24h |

**TTL 설정**
- DynamoDB 테이블 → 추가 설정 → TTL 활성화
- TTL 속성명: `ttl` (Unix timestamp)

> ⚠️ 전체 테이블 스캔(Scan) 금지 — 반드시 GSI Query만 사용한다.

---

### 1-3. SQS 큐 생성

**AWS 콘솔 → SQS → 대기열 생성**

- 유형: **표준(Standard)**
- 이름: `webhook-inspector-main`
- 표시 제한 시간(Visibility timeout): `30초`
- 메시지 보존 기간: `4일`
- 수신 메시지 대기 시간(Long Polling): `20초`
- 최대 메시지 크기: `256KB`

> 생성 후 대기열 URL과 ARN을 팀 공유 문서에 기록한다.

---

### 1-4. EC2 Launch Template & Auto Scaling Group 구성

**IAM 역할 생성 (EC2용)**
- 역할 이름: `webhook-inspector-ec2-role`
- 연결 정책:
  - `AmazonDynamoDBFullAccess`
  - `AmazonSQSFullAccess`
  - `CloudWatchAgentServerPolicy`

**Launch Template 생성**
- 이름: `webhook-inspector-lt`
- AMI: Amazon Linux 2023 (최신)
- 인스턴스 유형: `t3.micro`
- IAM 인스턴스 프로파일: `webhook-inspector-ec2-role`
- Security Group: `sg-ec2`
- User Data (인스턴스 시작 시 자동 실행):

```bash
#!/bin/bash
# Java 21 설치
dnf install -y java-21-amazon-corretto

# CloudWatch Agent 설치
dnf install -y amazon-cloudwatch-agent

# CloudWatch Agent 설정 파일 작성
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'CWEOF'
{
  "metrics": {
    "namespace": "WebhookInspector",
    "metrics_collected": {
      "cpu": { "measurement": ["cpu_usage_idle", "cpu_usage_user"], "metrics_collection_interval": 60 },
      "mem": { "measurement": ["mem_used_percent"], "metrics_collection_interval": 60 }
    }
  }
}
CWEOF

# CloudWatch Agent 시작
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s

# 앱 배포 디렉토리 생성
mkdir -p /opt/webhook-inspector
```

**Auto Scaling Group 생성**
- 이름: `webhook-inspector-asg`
- Launch Template: `webhook-inspector-lt`
- 서브넷: Public Subnet A, Public Subnet B
- 최소 용량: `2`, 희망 용량: `2`, 최대 용량: `10`
- 조정 정책: CPU 사용률 70% 초과 시 Scale Out, 쿨다운 300s

---

### 1-5. ALB(Application Load Balancer) 구성

**ALB 생성**
- 이름: `webhook-inspector-alb`
- 체계: **인터넷 경계(Internet-facing)**
- IP 주소 유형: IPv4
- VPC: 위에서 생성한 VPC
- 서브넷: Public Subnet A, Public Subnet B
- Security Group: `sg-alb`

**대상 그룹(Target Group) 생성**
- 이름: `webhook-inspector-tg`
- 대상 유형: 인스턴스
- 프로토콜: HTTP / 포트: `8080`
- 헬스 체크 경로: `/actuator/health`
- Auto Scaling Group에 대상 그룹 연결

**리스너 설정**
- HTTP(80) → HTTPS(443) 리다이렉트
- HTTPS(443) → 대상 그룹 `webhook-inspector-tg` 포워딩
- SSL 인증서: ACM(AWS Certificate Manager)에서 발급한 도메인 인증서 연결

**Sticky Session 설정**
- 대상 그룹 → 속성 편집
- 고착성(Stickiness): **로드 밸런서 생성 쿠키** 활성화
- 지속 시간: `1일(86400초)`

> ⚠️ WebSocket 연결의 인스턴스 친화성 보장을 위해 Sticky Session은 반드시 활성화한다.

---

### 1-6. S3 버킷 & CloudFront 배포 구성

**S3 버킷 생성**
- 버킷 이름: `webhook-inspector-dashboard`
- 리전: 서비스 리전과 동일
- 퍼블릭 액세스 차단: **모두 차단** (CloudFront OAC로만 접근)
- 정적 웹사이트 호스팅: 비활성화 (CloudFront 경유)

**CloudFront 배포 생성**
- 원본 도메인: S3 버킷
- 원본 액세스: **OAC(Origin Access Control)** 생성 후 연결
- S3 버킷 정책에 CloudFront OAC 접근 허용 정책 추가
- 기본 루트 객체: `index.html`
- 오류 페이지: 403, 404 → `/index.html` (React SPA 라우팅 대응)
- 뷰어 프로토콜 정책: **HTTPS만**
- 캐시 정책: `CachingOptimized`

---

### 1-7. 도메인 & DNS 설정

ALB는 같은 도메인에서 HTTP와 WebSocket을 동시에 처리할 수 있으므로 WebSocket 전용 서브도메인은 별도로 필요하지 않다. 경로(path)로 구분한다.

```
https://api.hook.example.com/v1/...   → REST API
wss://api.hook.example.com/ws         → WebSocket
```

**Route 53 (또는 사용 중인 DNS)**

| 레코드 | 유형 | 값 | 용도 |
|--------|------|----|------|
| `api.hook.example.com` | A (Alias) | ALB DNS | REST API + WebSocket |
| `hook.example.com` | A (Alias) | ALB DNS | 외부 서비스 웹훅 수신 |
| `dashboard.hook.example.com` | A (Alias) | CloudFront DNS | 대시보드 화면 |

**ACM 인증서**
- `*.hook.example.com` 와일드카드 인증서 발급
- DNS 검증 방식으로 발급 후 ALB 리스너에 연결

---

### Phase 1 완료 기준

- [ ] VPC · 서브넷 · IGW · SG가 콘솔에서 정상 확인된다.
- [ ] DynamoDB 테이블과 4개 GSI가 생성되어 있고 TTL이 활성화되어 있다.
- [ ] SQS 대기열이 생성되어 있고 Long Polling(20s)이 설정되어 있다.
- [ ] EC2 인스턴스 2대가 Auto Scaling Group에서 `InService` 상태다.
- [ ] ALB 헬스 체크가 정상(Healthy)이고 Sticky Session이 활성화되어 있다.
- [ ] S3 버킷과 CloudFront 배포가 생성되어 `index.html` 접근이 가능하다.
- [ ] 도메인 3개(api, hook, dashboard)가 DNS에서 정상 해석된다.
- [ ] 팀 공유 문서에 모든 ARN · URL · 엔드포인트가 기록되어 있다.

---

## Phase 2 · 인증 & 웹훅 URL 발급 (FR-001)

> **구현 컴포넌트:** CMP-001 AuthService (MOD-002 UrlModule)  
> 회원가입·로그인·JWT 발급은 **Supabase Auth**에 완전 위임한다. 백엔드는 JWT 검증만 담당한다.

### 인증 구조 개요

```
[프론트엔드]                    [Supabase Auth]            [Spring Boot 백엔드]
회원가입 / 로그인 요청  ──────▶  이메일 인증, JWT 발급
                                access_token 반환  ──────▶  JWT 서명 검증만 수행
                                                            (user_id = Supabase UID)
```

- 회원가입·로그인·토큰 갱신은 프론트엔드에서 Supabase JS SDK로 직접 처리
- Spring Boot 백엔드는 Supabase가 발급한 JWT를 검증하여 `user_id(Supabase UID)` 추출만 담당
- DynamoDB User 테이블에 이메일·비밀번호를 저장하지 않음 — `supabase_uid` + `webhook_uuid`만 관리

---

### 2-1. Supabase 프로젝트 설정

**Supabase 콘솔 (supabase.com)**
- 새 프로젝트 생성
- Authentication → Providers → Email 활성화
- 이메일 확인(Email Confirm) 정책 결정 (개발 중에는 비활성화 권장)
- `Project URL`, `anon key`, `JWT Secret` 확인 후 팀 공유 문서에 기록

**프론트엔드 Supabase SDK 설치**
```bash
npm install @supabase/supabase-js
```

**Supabase 클라이언트 초기화 (`src/lib/supabase.ts`)**
```typescript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

**프론트엔드 인증 흐름**
```typescript
// 회원가입
await supabase.auth.signUp({ email, password })

// 로그인
await supabase.auth.signInWithPassword({ email, password })

// 토큰 갱신 (Supabase SDK가 자동 처리)
// API 요청 시 access_token을 Authorization 헤더에 첨부
const { data: { session } } = await supabase.auth.getSession()
headers: { Authorization: `Bearer ${session.access_token}` }
```

---

### 2-2. Spring Boot 프로젝트 설정

- Spring Boot 3.x + Gradle 프로젝트 초기화
- 의존성: `spring-boot-starter-web`, `spring-boot-starter-websocket`, `spring-cloud-aws 3.x`, `aws-sdk-v2-dynamodb`
- `jjwt`, `spring-security-crypto`(BCrypt) **제거** — Supabase가 대신 처리
- `application.yml` 환경 변수 설정

```yaml
supabase:
  jwt-secret: ${SUPABASE_JWT_SECRET}   # Supabase 콘솔 JWT Secret

aws:
  region: ${AWS_REGION}
  dynamodb:
    table-name: ${DYNAMODB_TABLE_NAME}
  sqs:
    queue-url: ${SQS_QUEUE_URL}
```

---

### 2-3. JWT 검증 미들웨어 구현

Supabase JWT는 `HS256` 알고리즘으로 서명되어 있으며, Supabase 콘솔의 `JWT Secret`으로 검증한다.

- `JwtVerificationFilter` (`OncePerRequestFilter`) 구현
  - `Authorization: Bearer {token}` 헤더 파싱
  - Supabase JWT Secret으로 서명 검증
  - 페이로드에서 `sub` 클레임 추출 → `supabase_uid` (= `user_id`) 로 사용
  - `SecurityContextHolder`에 인증 정보 등록
- 검증 실패 시 401 반환
- 웹훅 수신 엔드포인트(`POST /{uuid}`)는 인증 제외

> ⚠️ JWT Secret은 환경 변수로만 관리하고 코드에 하드코딩하지 않는다.

---

### 2-4. DynamoDB 연동 및 User 레코드 관리

- `DynamoDbClient` Bean 설정 (EC2 IAM 역할 자동 인증)
- User 레코드 구조: `supabase_uid` + `webhook_uuid` + `is_active` 만 저장

**첫 로그인 시 User 레코드 자동 생성 흐름**
1. 프론트엔드가 Supabase 로그인 완료 후 `GET /v1/webhook-url` 호출
2. 백엔드가 JWT에서 `supabase_uid` 추출
3. DynamoDB에 해당 `supabase_uid` User 레코드가 없으면 신규 생성 + `webhook_uuid` 발급
4. 있으면 기존 `webhook_uuid` 반환

---

### 2-5. 웹훅 URL 관리 구현 (URL-001, URL-002)

- `GET /v1/webhook-url` — 발급된 URL 조회 (없으면 자동 생성)
- `PATCH /v1/webhook-url` — 활성화/비활성화 토글
- 비활성 URL로의 요청 시 403 응답 처리

---

### 2-6. EC2 배포

- Gradle `bootJar`로 JAR 빌드
- SCP 또는 S3 경유로 EC2 인스턴스에 JAR 업로드
- `systemd` 서비스 등록, 환경 변수 (`SUPABASE_JWT_SECRET` 등) 주입 후 실행
- ALB 헬스 체크(`/actuator/health`) 정상 확인

---

**완료 기준**
- 프론트엔드에서 Supabase 회원가입·로그인이 정상 동작한다.
- Supabase JWT를 `Authorization` 헤더에 담아 `GET /v1/webhook-url` 호출 시 웹훅 URL이 반환된다.
- 잘못된 JWT 또는 토큰 없이 요청 시 401이 반환된다.
- 비활성 URL 접근 시 403이 반환된다.

---

## Phase 3 · 웹훅 수신 파이프라인 (FR-001, FR-002)

> **구현 컴포넌트:** CMP-002 IngestionService (MOD-003 IngestionController + MOD-004 WorkerService)

### 3-1. IngestionController 구현 (MOD-003)
- `POST https://hook.example.com/{uuid}` (`@RestController`)
- UUID 유효성 확인: DynamoDB GSI(`GSI-webhookUuid`) 조회 → `user_id`, `is_active` 취득
  - UUID 미등록 → 404, 비활성 → 403
- 원본 `headers` + `body` + meta 전체를 SQS enqueue (EVT-001)
- 외부 서비스에 즉시 `200 OK { message_id, status: "received" }` 반환

**EVT-001 SQS 메시지 페이로드:**
```json
{
  "webhook_id": "wh-...",
  "user_id": "...",
  "uuid": "...",
  "method": "POST",
  "headers": { },
  "body": "...",
  "content_type": "application/json",
  "source_ip": "...",
  "received_at": "2026-05-25T10:30:00Z"
}
```

### 3-2. SQS 연동 (DEP-003)
- `spring-cloud-aws-starter-sqs` 설정
- `SqsTemplate` Bean 등록
- Long Polling 20s, `visibilityTimeout` 30s 설정
- SQS 대기열 URL: Phase 1에서 생성한 `webhook-inspector-main` URL 참조

### 3-3. WorkerService 구현 (MOD-004)
- `@SqsListener("webhook-inspector-main")` — 배치 최대 10개 소비
- DynamoDB `PutItem`: WebhookEvent (DM-002) 저장, TTL(`ttl`) 필드 = 현재 시각 + 30일
- MOD-006 `pushEvent(user_id, webhook_event)` 호출

### 3-4. 이력 조회 API 구현 (HISTORY-001, HISTORY-002)
- `GET /v1/webhooks` — 페이지네이션 (limit/offset, 최대 100건)
- `GET /v1/webhooks/{webhook_id}` — 상세 조회 (헤더 전체 + body)
- 타인의 `webhook_id` 접근 시 403 처리

**완료 기준**
- 외부 서비스 POST 후 200이 즉시 반환되고, DynamoDB에 WebhookEvent가 저장된다.
- 이력 조회 API가 올바른 데이터를 반환한다.
- 비활성 URL / 미등록 UUID에 대한 4xx 처리가 정상 동작한다.

---

## Phase 4 · 실시간 대시보드 (FR-002)

> **구현 컴포넌트:** CMP-003 RealtimeService (MOD-005 WebSocketHandler + MOD-006 PushSender) + React 프론트엔드

### 4-1. Spring WebSocket(STOMP) 설정 (MOD-005)
- `WebSocketMessageBrokerConfigurer` 설정
- ALB sticky session 연동: `wss://api.hook.example.com/ws?token={jwt}`
- 연결 시 DynamoDB `WsConnection (DM-003)` 저장, TTL = 현재 시각 + 24h
- 연결 해제 시 DynamoDB 레코드 삭제 (WS-001, WS-002)
- WebSocket 연결 최대 3개/사용자 제한

### 4-2. PushSender 구현 (MOD-006)
- `SimpMessagingTemplate.convertAndSendToUser(userId, "/queue/webhooks", payload)` 전송 (EVT-003)
- DynamoDB Query: `GSI-userId-connection` → `connection_id` 목록 조회
- ALB sticky session으로 동일 인스턴스 내 세션에 직접 접근

**EVT-003 WebSocket Push 페이로드:**
```json
{
  "type": "NEW_WEBHOOK",
  "webhook_id": "wh-...",
  "user_id": "...",
  "method": "POST",
  "received_at": "2026-05-25T10:30:00Z",
  "content_type": "application/json",
  "body_preview": "{\"event\": \"payment.success\", ...}"
}
```

### 4-3. React 대시보드 프론트엔드
- React 18 + Vite 프로젝트 초기화
- 주요 화면 구현

| 화면 | 기능 |
|------|------|
| 회원가입 / 로그인 | Supabase Auth SDK (`supabase.auth.signUp` / `signInWithPassword`) |
| 웹훅 URL 발급 페이지 | URL-001, URL-002 연동, URL 복사 버튼 |
| 대시보드 (이력 목록) | HISTORY-001 연동, 실시간 EVT-003 수신 목록 갱신 |
| 이벤트 상세 보기 | HISTORY-002 연동, 헤더 전체 + JSON Pretty Print |

- STOMP.js WebSocket 클라이언트 연결 (`wss://api.hook.example.com/ws`)
- 수신 즉시 목록 상단 삽입 (새로고침 없이)

### 4-4. S3 + CloudFront 배포
- `npm run build` 후 생성된 `dist/` 를 S3 버킷에 업로드
  ```bash
  aws s3 sync dist/ s3://webhook-inspector-dashboard --delete
  ```
- CloudFront 캐시 무효화
  ```bash
  aws cloudfront create-invalidation --distribution-id {ID} --paths "/*"
  ```

**완료 기준**
- 웹훅 수신 후 대시보드 실시간 표시까지 P95 기준 1초 이내 (NFR-002)
- WebSocket 연결·해제가 DynamoDB에 정상 기록된다.
- 대시보드에서 헤더·페이로드 전체 확인이 가능하다.
- 과거 이력 최근 1,000건 조회가 가능하다.

---

## Phase 5 · 모니터링 & 운영 (NFR-003, NFR-006)

> **목표:** 트래픽 폭증 대응과 운영 가시성 확보.

### 5-1. CloudWatch 대시보드 구성 (DEP-007)

**CloudWatch Agent 설정 확인**
- Phase 1 User Data로 설치된 Agent가 각 EC2 인스턴스에서 정상 동작하는지 확인
- 지표 네임스페이스: `WebhookInspector`
- 수집 지표: EC2 CPU·메모리, JVM heap (Spring Actuator → CloudWatch 커스텀 지표)

**`cloudwatch-dash` 대시보드 위젯 구성**

| 위젯 | 지표 |
|------|------|
| 초당 웹훅 수신량 | ALB RequestCount |
| 처리 지연 P95 | ALB TargetResponseTime |
| EC2 CPU 사용률 | CloudWatch Agent CPUUtilization |
| 메모리 사용률 | CloudWatch Agent mem_used_percent |
| SQS 대기 메시지 수 | ApproximateNumberOfMessagesVisible |
| 오류율 | HTTPCode_Target_5XX_Count / RequestCount |

**CloudWatch 알람 설정**
- CPU > 70% → SNS 알림
- SQS 대기 메시지 > 1000 → SNS 알림
- ALB 5xx 오류율 > 5% → SNS 알림

### 5-2. Auto Scaling 정책 검증
- CPU 70% 초과 시 Scale Out 동작 확인
- Scale In 쿨다운 300s 확인
- 스파이크 발생 후 60초 이내 정상 복귀 목표 (NFR-003)

### 5-3. 부하 테스트
- 시나리오: 초당 100건 이상 웹훅 수신 (NFR-003)
- 도구: k6 / Apache Bench
- 검증 항목
  - 웹훅 수신 → 200 응답 지연 P95 < 500ms
  - 대시보드 Push 지연 P95 < 1s (NFR-002)
  - DynamoDB 저장 완료 P95 < 3s
  - 오류율 5% 미만

**완료 기준**
- CloudWatch 대시보드에서 핵심 지표가 실시간으로 시각화된다.
- CloudWatch 알람 3개가 정상 동작한다.
- 부하 테스트 통과 (NFR-002, NFR-003 달성).

---

## Phase 6 · 안정화 & 릴리즈

> **목표:** 보안·품질 점검을 완료하고 프로덕션 배포한다.

### 6-1. 보안 점검 (NFR-005)
- Supabase JWT 검증 미들웨어 엣지 케이스 전수 테스트 (만료·변조·서명 불일치)
- HTTPS(TLS 1.2+) 전 구간 적용 확인
- UUID v4 추측 불가능성 검증
- DynamoDB 타인 데이터 접근 차단 (403 처리) 검증
- ALB → EC2 Security Group (`sg-ec2`) 트래픽 제한 확인
- EC2 IAM 역할 최소 권한 원칙 검토
- `SUPABASE_JWT_SECRET` 환경 변수 외부 노출 여부 확인

### 6-2. 데이터 내구성 검증 (NFR-004)
- DynamoDB on-demand 모드 내구성 99.99% 확인
- TTL 동작 검증 (WebhookEvent 30일, WsConnection 24h)
- DynamoDB GSI 쿼리 전체 스캔 없음 검증

### 6-3. 통합 테스트 & E2E
- 전체 시나리오 E2E 테스트
  - 회원가입 → URL 발급 → 외부 웹훅 POST → 대시보드 실시간 표시
  - URL 비활성화 → 4xx 응답 확인
  - WebSocket 연결·해제 → DynamoDB 세션 정합성
- Out of Scope 항목 미구현 확인 (모바일 앱, 결제, 포워딩 등)

### 6-4. 문서화
- API 문서 최종본 정리 (Swagger / Redoc)
- 운영 런북: 장애 대응 절차, CloudWatch 알람별 대응 가이드
- 인프라 세팅 가이드 (Phase 1 콘솔 설정 절차 문서화)
- 배포 가이드 (JAR 빌드 → EC2 업로드 → 재시작 절차)

### 6-5. 프로덕션 최종 배포
- EC2 인스턴스 2대에 최신 JAR 순차 배포 (무중단 배포)
- React 빌드 → S3 업로드 → CloudFront 캐시 무효화
- 최종 가용성 확인 (월간 99.9% 목표, NFR 달성 확인)

**완료 기준**
- 보안·NFR 체크리스트 전항목 통과.
- E2E 테스트 전 시나리오 통과.
- 월간 서비스 가용성 99.9% 이상 기준 충족.

---

## 주요 제약 & Out of Scope

| 항목 | 설명 |
|------|------|
| 모바일 앱 | 웹 대시보드(React)만 제공, 모바일 앱 개발 없음 |
| 결제·과금 | MVP 무료, 과금 모델 설계 없음 |
| 멀티클라우드 | AWS 단일 클라우드 전용 (GCP·Azure 미지원) |
| 웹훅 포워딩 | 수신 웹훅의 외부 서버 중계 기능 미포함 (향후 확장 예정) |
| 비HTTP 프로토콜 | gRPC·MQTT 등 미지원 |
| DynamoDB 전체 스캔 | GSI 쿼리만 허용, 테이블 풀스캔 금지 |
| IaC | AWS CDK·Terraform 등 IaC 도구 미사용, 콘솔 직접 세팅 |

---

## 향후 확장 (Future Extensibility)

- **사용자 지정 목적지 포워딩:** 수신 웹훅을 등록된 외부 URL로 중계(Relay)
  - `RelayService`, `DestinationService` 컴포넌트 추가
  - SQS retry queue + DLQ 기반 실패 격리 및 수동 Replay
  - 지수적 백오프 재시도
- **IaC 도입:** 인프라 규모 확장 시점에 AWS CDK 또는 Terraform으로 현재 콘솔 설정을 코드화

---

## 성공 지표 (Success Metrics)

| 지표 | 목표 |
|------|------|
| 웹훅 수신 → 대시보드 표시 지연 | P95 기준 **1초 이내** |
| 웹훅 수신 → DynamoDB 저장 완료 | P95 기준 **3초 이내** |
| 월간 서비스 가용성 | **99.9% 이상** (월 downtime 44분 이내) |
| 트래픽 스파이크 복귀 | 스파이크 발생 후 **60초 이내** 정상 복귀 |
| 처리 중 오류율 | **5% 미만** |
