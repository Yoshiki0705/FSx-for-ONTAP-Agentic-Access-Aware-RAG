# .metadata.json 공식 스키마 사양

**🌐 Language:** [日本語](../metadata-json-schema.md) | [English](../en/metadata-json-schema.md) | **한국어**

**작성일**: 2026-06-08  
**상태**: 공식 사양  
**대상**: 개발자, 데이터 엔지니어, 파트너

---

## 개요

FSx for ONTAP의 문서에 권한 정보를 부여하기 위한 메타데이터 파일(`.metadata.json`)의 공식 사양입니다. Bedrock Knowledge Base의 metadata filtering과 연동하여 Permission-Aware RAG를 구현합니다.

---

## 파일 명명 규칙

```
대상 문서:     {path}/{filename}.{ext}
메타데이터 파일: {path}/{filename}.{ext}.metadata.json
```

**예시:**
```
reports/esg/2026-06-06/report-abc.json
reports/esg/2026-06-06/report-abc.json.metadata.json  ← 메타데이터
```

---

## 스키마 정의

```json
{
  "metadataAttributes": {
    "allowed_group_sids": ["S-1-1-0", "S-1-5-21-xxx-512"],
    "category": "esg",
    "owner": "sustainability-team",
    "classification": "internal"
  }
}
```

### 필드 목록

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `metadataAttributes` | Object | ✅ | 메타데이터 속성 컨테이너 |
| `metadataAttributes.allowed_group_sids` | `string[]` (공식) 또는 `string` (하위 호환) | ✅ | 접근 허용 SID 목록 |
| `metadataAttributes.category` | `string` | ❌ | 문서 카테고리 |
| `metadataAttributes.owner` | `string` | ❌ | 소유자 (팀/부서) |
| `metadataAttributes.classification` | `string` enum | ❌ | 기밀 등급 |

### `allowed_group_sids` 형식

| 형식 | 예시 | 상태 |
|------|------|------|
| **배열 (공식)** | `["S-1-1-0", "S-1-5-21-xxx-512"]` | ✅ 권장 |
| 쉼표 구분 | `"S-1-1-0,S-1-5-21-xxx-512"` | ⚠️ 하위 호환 (비권장) |
| JSON 문자열 | `"[\"S-1-1-0\"]"` | ⚠️ 하위 호환 (비권장) |
| 단일 값 | `"S-1-1-0"` | ⚠️ 하위 호환 |

> **중요**: 새로 생성할 때는 반드시 **배열 형식**을 사용하세요.

### `classification` 유효 값

| 값 | 설명 |
|----|------|
| `public` | 공개 정보 (모든 사용자 접근 가능) |
| `internal` | 사내 한정 |
| `confidential` | 기밀 (특정 그룹만) |
| `restricted` | 극비 (개별 승인 필요) |

---

## SID 형식

Windows Security Identifier (SID) 표준 형식:

```
S-{revision}-{authority}-{sub1}-{sub2}-...-{RID}
```

| SID | 의미 |
|-----|------|
| `S-1-1-0` | Everyone (모든 사용자) |
| `S-1-5-21-xxx-512` | Domain Admins |
| `S-1-5-21-xxx-513` | Domain Users |
| `S-1-5-32-544` | Administrators (Builtin) |

---

## Fail-Closed 원칙

| 상태 | 동작 |
|------|------|
| `.metadata.json`이 존재하지 않음 | **접근 거부** (Fail-Closed) |
| `allowed_group_sids`가 빈 배열 | **접근 거부** |
| `allowed_group_sids`에 사용자 SID와 일치하는 것이 없음 | **접근 거부** |
| `allowed_group_sids`에 사용자 SID와 일치하는 것이 있음 | **접근 허용** |

---

## 검증 규칙

1. `metadataAttributes`는 필수
2. `allowed_group_sids`는 필수이며 비어있으면 안 됨
3. 각 SID는 `S-`로 시작하는 유효한 형식 (경고만, 차단하지 않음)
4. 쉼표 구분 형식은 경고를 출력하고 배열 형식으로의 마이그레이션을 권장

---

## 생성 도구

```bash
# 스크립트로 공식 형식의 메타데이터 생성
python3 -c "
import json
metadata = {
    'metadataAttributes': {
        'allowed_group_sids': ['S-1-1-0', 'S-1-5-21-xxx-512'],
        'category': 'esg',
        'classification': 'internal'
    }
}
print(json.dumps(metadata, indent=2))
" > document.json.metadata.json
```

---

## 관련 문서

- [Permission Matrix 테스트](../../tests/permission-matrix/) — 31개 시나리오의 권한 검증
- [KB Auto-Sync 오류 처리](../kb-auto-sync-error-handling.md) — 메타데이터 포함 문서 인제스트
- [프로덕션 준비 체크리스트](../production-readiness-checklist.md) — 메타데이터 관리 운용 요건
