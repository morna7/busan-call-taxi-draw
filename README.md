# 장거리전문부산콜택시 배차 추첨

장거리 콜 의뢰를 등록하고, 기사님들이 모바일 웹에서 3분 안에 참여하면 서버에서 공정하게 1명을 추첨하는 Next.js + Supabase 앱입니다.

## 주요 기능

- Supabase Auth 기반 관리자 로그인
- 의뢰 등록, 예약 시작, 즉시 시작, 취소, 시작 전 수정
- 공개 참여 링크 `/join/[publicCode]`
- 닉네임 + 차량번호 뒤 4자리 중복 참여 방지
- 같은 브라우저 재참여 방지를 위한 localStorage 기록
- 서버 저장 시간 `start_at`, `end_at` 기준 참여 가능 여부 판단
- Node.js `crypto.randomInt` 기반 서버 추첨
- 상태 전이: 대기중, 진행중, 마감중, 완료, 취소
- Supabase Realtime 기반 목록/참여자 수 갱신
- QR 코드, 참여 링크 복사, 결과 복사
- audit log 저장

## 설치 방법

```bash
npm install
```

Windows PowerShell 실행 정책 때문에 `npm`이 막히면 다음처럼 실행할 수 있습니다.

```bash
npm.cmd install
```

## Supabase 설정 순서

1. Supabase 프로젝트를 생성합니다.
2. Supabase 대시보드에서 `SQL Editor`를 엽니다.
3. `supabase/migrations/20260513000000_init_draw_lottery.sql` 내용을 실행합니다.
4. `Project Settings > API`에서 다음 값을 확인합니다.
   - Project URL
   - anon public key
   - service_role key
5. 프로젝트 루트에 `.env.local`을 만들고 `.env.example`을 참고해 값을 넣습니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY`는 서버 API에서만 사용됩니다. 브라우저에 노출되면 안 됩니다.

## 관리자 계정 만들기

1. Supabase 대시보드에서 `Authentication > Users`로 이동합니다.
2. `Add user`를 눌러 관리자 이메일과 비밀번호를 생성합니다.
3. 생성한 계정으로 `/admin/login`에서 로그인합니다.

현재 구현은 Supabase Auth에 로그인한 사용자를 관리자로 취급합니다. 운영에서 여러 역할이 필요하면 별도 `admin_users` 테이블을 추가해 `requireAdminUser()`에서 권한을 한 번 더 확인하도록 확장하면 됩니다.

## 로컬 실행

```bash
npm run dev
```

브라우저에서 다음 주소를 엽니다.

- 관리자 로그인: `http://localhost:3000/admin/login`
- 관리자 대시보드: `http://localhost:3000/admin`

## 테스트

```bash
npm run test
```

테스트 범위:

- 참여 가능 시간 안에 참여 가능
- `endAt` 이후 참여 실패
- 닉네임 + 차량번호 뒤 4자리 중복 감지
- 참여자 1명일 때 해당 참여자 당첨
- 참여자 여러 명 중 1명만 선택
- 동시에 여러 추첨 완료 요청이 와도 저장은 한 번만 수행
- 참여자 0명일 때 당첨자 없이 완료
- 로그인하지 않은 `/admin` 접근은 `/admin/login`으로 이동

## 사용 흐름

1. 관리자가 로그인합니다.
2. 새 의뢰를 등록합니다.
3. 즉시 시작 또는 예약 시작을 선택합니다.
4. 참여 링크 또는 QR 코드를 기사님들에게 공유합니다.
5. 기사님들이 제한 시간 안에 닉네임을 입력하고 참여합니다.
6. 시간이 끝나면 공개 화면 또는 관리자 대시보드가 서버 API를 호출해 자동 추첨을 완료합니다.
7. 관리자는 결과 복사 버튼으로 결과를 공유합니다.

## 추첨과 보안 설계

- 추첨은 프론트엔드에서 실행하지 않습니다.
- `/api/public/draw/[publicCode]/finalize` 또는 `/api/admin/draws/[id]/finalize`가 서버에서 `finalizeDraw()`를 실행합니다.
- 실제 당첨자 선택은 Node.js `crypto.randomInt(0, participants.length)`를 사용합니다.
- 마감 처리는 먼저 `draws.status`를 `open/scheduled`에서 `drawing`으로 원자적으로 바꾼 요청만 수행합니다.
- 동시에 여러 요청이 들어와도 이미 `drawing` 또는 `completed`가 된 추첨은 다시 뽑지 않습니다.
- 최종 저장은 SQL 함수 `complete_draw_with_winner`, `complete_draw_without_winner`에서 처리하며 audit log를 남깁니다.
- 공개 응답은 관리자 메모와 참여자 차량번호 뒤 4자리를 노출하지 않습니다.
- 완료된 추첨은 수정할 수 없습니다.

## 배포 방법

Vercel 배포 기준:

1. GitHub 저장소에 코드를 push합니다.
2. Vercel에서 새 프로젝트를 연결합니다.
3. 환경변수 4개를 Vercel Project Settings에 등록합니다.
4. Supabase Auth의 Site URL과 Redirect URLs에 배포 도메인을 추가합니다.
5. 배포 후 `/admin/login`에서 관리자 로그인과 의뢰 등록을 확인합니다.

Supabase Realtime을 사용하려면 마이그레이션의 publication 설정이 적용되어야 합니다. Supabase 대시보드의 `Database > Replication`에서 `draws`, `participants`가 Realtime 대상인지 확인할 수 있습니다.

## Vercel 로그인 문제 확인

Vercel에서만 로그인이 실패하면 먼저 `/admin/login` 화면의 `배포 환경변수 확인` 영역을 확인합니다. 이 영역은 실제 키 값은 노출하지 않고 다음 값이 브라우저와 서버에서 로드됐는지만 보여줍니다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

같은 정보는 아래 주소에서도 JSON으로 확인할 수 있습니다.

```text
https://your-vercel-domain.vercel.app/api/diagnostics/env
```

로그인 실패 시에는 Supabase가 반환한 실제 `error.message`가 화면에 표시됩니다. 예를 들어 `Invalid login credentials`, `Email not confirmed`, `Failed to fetch` 같은 메시지를 보고 원인을 좁힐 수 있습니다.

## 결과 복사 형식

완료된 추첨의 관리자 상세 화면에서 다음 형식으로 복사됩니다.

```text
[장거리전문부산콜택시 배차 추첨 결과]
의뢰: 부산 → 서울 장거리 콜
출발지: 부산 ○○구
도착지: 서울 ○○구
참여자 수: 8명
당첨자: 홍길동
추첨 완료 시간: 2026-05-13 14:03
```
