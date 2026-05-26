# Webhook Inspector

> ⚠️ **현재 개발 진행 중인 프로젝트입니다.** 미완성 상태이며 프로덕션 사용 불가합니다.

백엔드 개발자가 Stripe, GitHub 등 외부 서비스의 웹훅을 실시간으로 수신·검사·디버깅할 수 있는 플랫폼입니다.

---

## 프로젝트 구조

```
webhook-inspector/          ← Git 루트 (이 폴더)
├── backend/                ← Spring Boot 3.x (Java 21)
├── frontend/               ← React 18 + Vite
├── plan/                   ← 설계 문서 (PRD, APISpec, ArchSpec 등)
└── process_state/          ← 작업 진행 상태 추적
```

---

## 개발 환경 설정

### 백엔드 (IntelliJ IDEA)

```
File → Open → .../webhook-inspector/backend
```

- `backend/` 폴더를 직접 열어야 Gradle 프로젝트로 인식됩니다.
- 상위 폴더(`webhook-inspector/`)로 열면 Java 프로젝트를 인식하지 못합니다.
- Run Configuration → Environment variables → `.env file` 항목에 `backend/.env` 경로 지정 후 실행합니다.

### 프론트엔드 (VS Code)

```
File → Open Folder → .../webhook-inspector/frontend
```

- `frontend/.env` 파일에 Supabase 환경변수가 설정되어 있어야 합니다.

### Claude Code

```
claude  (webhook-inspector/ 루트에서 실행)
```

- 전체 프로젝트 구조를 인식하여 백엔드·프론트엔드·문서를 함께 관리합니다.

---

## GitHub Push 주의사항

- **push 루트는 이 폴더(`webhook-inspector/`)** 입니다. `backend/`나 `frontend/` 단독으로 push하지 않습니다.
- `.env` 파일은 `.gitignore`에 등록되어 있으므로 push되지 않습니다. 환경변수는 `.env_example`을 참고해 별도로 설정하세요.
- `backend/.env_example`, `frontend/.env_example` 파일에 각 변수의 설명과 예시 값이 있습니다.

---

## 이 구조로 설계한 이유

백엔드(Java)와 프론트엔드(React)는 사용하는 IDE와 도구가 다릅니다.

- IntelliJ는 `build.gradle`이 있는 폴더를 루트로 열어야 Java 프로젝트를 정상 인식합니다. 루트에 `build.gradle`이 없으면 실행 버튼이 비활성화됩니다.
- VS Code는 `package.json`과 Vite 설정이 있는 `frontend/` 폴더를 직접 열어야 개발 서버·자동완성이 정상 동작합니다.
- 두 프로젝트를 하나의 Git 저장소(모노레포)로 관리하면서도, 각 IDE가 자신의 영역만 정확히 인식하도록 폴더 단위로 열기 경로를 분리했습니다.
- 환경변수도 `backend/.env`, `frontend/.env`로 분리하여 각 도구가 자신의 `.env`만 참조합니다.
