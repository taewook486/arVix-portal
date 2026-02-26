# CI/CD 파이프라인 가이드

arVix-portal 프로젝트의 GitHub Actions CI/CD 파이프라인 설정 및 사용 가이드입니다.

## 워크플로우 파일 위치

| 파일 | 경로 | 용도 |
|------|------|------|
| CI 테스트 파이프라인 | `.github/workflows/test.yml` | 린트, 타입 체크, 테스트, 빌드 |
| 배포 파이프라인 | `.github/workflows/deploy.yml` | Vercel 배포 |

---

## CI 파이프라인 상세 (test.yml)

### 트리거 조건
- **Push**: `main`, `develop` 브랜치
- **Pull Request**: `main`, `develop` 브랜치로의 PR

### Job 1: Lint & Type Check

- **ESLint 실행**: `npm run lint`
- **TypeScript 타입 체크**: `npx tsc --noEmit`

```yaml
# 실행 명령어
npm run lint
npx tsc --noEmit
```

### Job 2: Test

- **테스트 실행**: `npm test`
- **커버리지 생성**: `npm run test:coverage`
- **커버리지 아티팩트 업로드**: 30일 보관

```yaml
# 실행 명령어
npm test
npm run test:coverage
```

#### 커버리지 임계값

현재 프로젝트의 커버리지 수준에 맞춰 점진적으로 설정되었습니다:

| 항목 | 임계값 | 현재 수준 |
|------|--------|----------|
| Statements | 35% | 35.66% |
| Branches | 30% | 30.99% |
| Functions | 28% | 28.09% |
| Lines | 36% | 36.21% |

### Job 3: Build

- **프로덕션 빌드**: `npm run build`
- **빌드 아티팩트 업로드**: 7일 보관

```yaml
# 실행 명령어
npm run build
```

### Job 4: PR Validation (Pull Request 시에만)

- 모든 체크 통과 후 PR 머지 가능 상태 확인

---

## 배포 파이프라인 상세 (deploy.yml)

### 트리거 조건
- **Push**: `main` 브랜치
- **수동 트리거**: `workflow_dispatch`

### 배포 환경

| 환경 | 조건 | 설명 |
|------|------|------|
| Preview | Pull Request | PR 생성 시 프리뷰 URL로 배포 |
| Production | main 브랜치 Push | 프로덕션 배포 |

### 배포 전 단계

1. **Pre-deploy Validation**: 배포 조건 확인
2. **CI 테스트 통과 필수**: `test.yml` 워크플로우 성공 필요

### 배포 후 단계

**Health Check**: 배포된 애플리케이션의 정상 작동 확인

- 최대 5회 시도
- 10초 간격으로 재시도
- HTTP 200 또는 304 응답 시 성공

---

## 필수 GitHub Secrets 설정

### Vercel 배포를 위해 필요한 Secrets

| Secret Name | 설명 | 가져오는 방법 |
|-------------|------|---------------|
| `VERCEL_TOKEN` | Vercel API 토큰 | Vercel Dashboard > Settings > Tokens |
| `VERCEL_ORG_ID` | Vercel 조직 ID | 프로젝트 설정 `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | Vercel 프로젝트 ID | 프로젝트 설정 `.vercel/project.json` |

### Secret 설정 방법

1. GitHub Repository > Settings > Secrets and variables > Actions
2. "New repository secret" 클릭
3. 위 표의 Secret 추가

#### Vercel 정보 가져오기

```bash
# Vercel CLI 설치 후
npm install -g vercel

# 프로젝트 링크
vercel link

# 프로젝트 정보 확인
cat .vercel/project.json
```

```json
{
  "orgId": "team_xxxxxxxxxxxxx",
  "projectId": "prj_xxxxxxxxxxxxx"
}
```

### 선택적 Secret/Variables

| Name | 설명 |
|------|------|
| `COVERAGE_GIST_ID` | PR에 커버리지 코멘트를 추가하기 위한 Gist ID |
| `SLACK_WEBHOOK_URL` | 배포 완료 시 Slack 알림 (Repository Variables) |

---

## Pull Request 체크리스트

PR이 머지되기 위해서는 다음 체크가 모두 통과해야 합니다:

- [ ] **Lint**: ESLint 검사 통과
- [ ] **Type Check**: TypeScript 타입 체크 통과
- [ ] **Test**: 모든 테스트 통과
- [ ] **Coverage**: 커버리지 임계값 충족
- [ ] **Build**: 프로덕션 빌드 성공

### 커버리지 감소 방지

- 커버리지가 5% 이상 감소하면 경고가 표시됩니다
- PR에서 커버리지 변화를 확인할 수 있습니다

---

## GitHub Actions 모니터링

### 워크플로우 실행 확인

1. GitHub Repository > Actions 탭
2. 왼쪽 사이드바에서 워크플로우 선택
3. 실행 내역 및 결과 확인

### 배포 상태 확인

1. **GitHub Actions**: 배포 워크플로우 실행 상태
2. **Vercel Dashboard**: 실시간 배포 로그 및 URL 확인
3. **배포된 URL**: Health Check 결과 확인

---

## 로컬에서 CI 실행하기

### 전체 CI 실행

```bash
# Lint
npm run lint

# Type Check
npx tsc --noEmit

# Test
npm test

# Coverage
npm run test:coverage

# Build
npm run build
```

### 개별 실행

```bash
# Lint만 실행
npm run lint

# 테스트만 실행
npm test

# 빌드만 실행
npm run build
```

---

## 문제 해결

### CI 실패 시

1. **Actions 탭에서 로그 확인**: 실패한 단계의 상세 로그 확인
2. **로컬에서 재현**: 실패한 명령어를 로컬에서 실행
3. **수정 후 재시도**: 새 커밋으로 PR 업데이트

### 커버리지 임계값 미달

1. **커버리지 리포트 확인**: `coverage/lcov-report/index.html` 브라우저에서 열기
2. **테스트 추가**: 커버리지가 부족한 부분에 테스트 작성
3. **임계값 조정**: `jest.config.js`의 `coverageThreshold` 수정

### Vercel 배포 실패

1. **Secret 확인**: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` 확인
2. **Vercel 로그 확인**: Vercel Dashboard에서 배포 로그 확인
3. **Health Check 실패**: 배포된 URL의 정상 작동 확인

---

## 다음 단계

1. **GitHub Secrets 설정**: 필수 Secret 값들 설정
2. **Branch Protection 설정**: main 브랜치에 PR 요구 및 CI 통과 필수
3. **초기 배포**: 첫 프로덕션 배포 실행
4. **모니터링**: 배포 후 애플리케이션 동작 확인

---

## 참고 자료

- [GitHub Actions 문서](https://docs.github.com/actions)
- [Vercel 배포 문서](https://vercel.com/docs/deployments/overview)
- [Next.js 배포 가이드](https://nextjs.org/docs/deployment)
