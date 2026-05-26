# Webhook Inspector — Agent Bootstrap Guide

## 프로젝트 개요
백엔드 개발자가 외부 웹훅(Stripe, GitHub 등)을 실시간 수신·검사·디버깅할 수 있는 플랫폼.
개발자별 고유 수신 URL 발급 + 웹 대시보드 실시간 시각화가 핵심.

## 작업 시작 절차

1. `process_state/process_state.json` 읽기 → `current_task`, `status`, `next_steps` 확인
2. 해당 태스크의 `related_docs` 에 명시된 `plan/` 문서 참조
3. `completed_tasks` 로 완료 맥락 파악 후 작업 이어서 진행
4. 작업 완료 시 반드시 `process_state.json` 업데이트

## 디렉토리 구조

```
/
├── CLAUDE.md                  # 이 파일
├── plan/
│   ├── PRD.md                 # 제품 요구사항 (FR, NFR, User Stories)
│   ├── APISpec.md             # REST + WebSocket 엔드포인트 전체 정의
│   ├── ArchSpec.md            # 모듈 구성, 의존성, 데이터 흐름
│   ├── TechSpec.md            # 컴포넌트, 데이터모델, 기술스택, 제약
│   ├── Diagrams.md            # Mermaid 다이어그램 5종
│   └── ROADMAP.md             # 단계별 구현 로드맵
├── process_state/
│   └── process_state.json     # 현재 작업 상태 추적
├── backend/                   # Spring Boot 3.x (Java 21)
└── frontend/                  # React 18 + Vite
```

## 핵심 아키텍처 요약

| 레이어 | 기술 |
|--------|------|
| 인증 | Supabase Auth (JWT HS256) — 백엔드는 검증만 |
| API / WebSocket | Spring Boot 3.x on EC2 ASG (t3.micro) |
| 웹훅 수신 버퍼 | AWS SQS Standard Queue |
| 저장소 | AWS DynamoDB (단일 테이블, GSI) |
| 실시간 Push | Spring WebSocket (STOMP) + ALB sticky session |
| 프론트엔드 | React 18 → S3 + CloudFront |

**도메인 3개:** Auth(MOD-001,002) / Ingestion(MOD-003,004) / Realtime(MOD-005,006)

## 주요 제약

- 자체 인증 로직 구현 금지 → Supabase Auth 위임
- DynamoDB 전체 스캔 금지 → GSI 조회만 허용
- IaC 미사용 → AWS 콘솔 직접 세팅
- WebSocket sticky session 필수 (ALB stickiness duration 1일)
- 모바일 앱·결제 로직 범위 외
