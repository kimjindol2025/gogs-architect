# @freelang/http-server v1.0.0

**FreeLang v2 HTTP 서버 모듈**

순수 FreeLang으로 구현된 HTTP 서버 라이브러리. 외부 의존성 없이 REST API 서버를 구축할 수 있습니다.

---

## ✨ 특징

- ✅ **100% Pure FreeLang**: 외부 라이브러리 의존 없음
- ✅ **HTTP/1.1 지원**: GET, POST, PUT, DELETE, PATCH
- ✅ **라우팅**: 경로 기반 핸들러 등록
- ✅ **응답 빌더**: JSON, HTML, 텍스트 자동 직렬화
- ✅ **메모리 효율**: 버퍼 재사용, Zero-copy
- ✅ **타입 안전**: FreeLang 타입 시스템 완전 활용

---

## 📦 설치

```bash
kpm install @freelang/http-server
```

---

## 🚀 빠른 시작

```freelang
use "http-module" as HTTP

fn main(): void {
  // 1. 서버 생성
  let server = HTTP.Server(8080)

  // 2. 라우트 등록
  server.route()
    .get("/", fn(req) {
      return HTTP.ok("{\"message\":\"Hello\"}")
    })
    .get("/api/users", fn(req) {
      return HTTP.ok("[{\"id\":1,\"name\":\"Alice\"}]")
    })

  // 3. 서버 시작
  server.listen(fn(s) {
    print("Server on port " + s.port)
  })
}
```

---

## 📚 API

### Server

```freelang
let server = HTTP.Server(8080)  // 포트 8080에서 생성

server.route()                  // 라우터 접근
server.listen(callback)         // 서버 시작
```

### Router

```freelang
server.route()
  .get(path, handler)          // GET 메서드
  .post(path, handler)         // POST 메서드
  .put(path, handler)          // PUT 메서드
  .delete(path, handler)       // DELETE 메서드
  .match(method, path)         // 핸들러 조회
```

### Request

```freelang
req.method              // "GET", "POST", etc
req.path               // "/api/users"
req.version            // "HTTP/1.1"
req.getHeader(key)     // 헤더 값 조회
req.body               // 요청 본문
```

### Response

```freelang
let resp = HTTP.Response(200, "OK")

resp.setHeader(key, value)     // 헤더 설정
resp.json(data)                // JSON 응답
resp.text(data)                // 텍스트 응답
resp.html(data)                // HTML 응답
resp.serialize()               // HTTP 직렬화
```

### 헬퍼 함수

```freelang
HTTP.ok(body)              // 200 OK
HTTP.created(body)         // 201 Created
HTTP.badRequest(error)     // 400 Bad Request
HTTP.notFound()            // 404 Not Found
HTTP.internalError(error)  // 500 Internal Server Error
```

---

## 💡 예제

### 1. 기본 서버

```freelang
use "http-module" as HTTP

fn main(): void {
  let server = HTTP.Server(8080)

  server.route().get("/", fn(req) {
    return HTTP.ok("{\"message\":\"Hello, World!\"}")
  })

  server.listen(nil)
}
```

### 2. REST API 서버

```freelang
use "http-module" as HTTP

class UserAPI {
  fn getAll(req: HTTP.Request): HTTP.Response {
    let users = "[{\"id\":1,\"name\":\"Alice\"},{\"id\":2,\"name\":\"Bob\"}]"
    return HTTP.ok(users)
  }

  fn getById(id: int, req: HTTP.Request): HTTP.Response {
    let user = "{\"id\":" + id + ",\"name\":\"User" + id + "\"}"
    return HTTP.ok(user)
  }

  fn create(req: HTTP.Request): HTTP.Response {
    let new_user = "{\"id\":3,\"name\":\"Charlie\",\"status\":\"created\"}"
    return HTTP.created(new_user)
  }
}

fn main(): void {
  let server = HTTP.Server(8080)
  let api = UserAPI()

  server.route()
    .get("/api/users", fn(req) { return api.getAll(req) })
    .get("/api/users/1", fn(req) { return api.getById(1, req) })
    .post("/api/users", fn(req) { return api.create(req) })

  server.listen(fn(s) {
    print("REST API Server listening on port " + s.port)
  })
}
```

### 3. 에러 처리

```freelang
use "http-module" as HTTP

fn handleRequest(path: Str): HTTP.Response {
  if path == "/api/users" {
    return HTTP.ok("[...]")
  } else if path == "/api/admin" {
    return HTTP.badRequest("Unauthorized")
  } else {
    return HTTP.notFound()
  }
}

fn main(): void {
  let server = HTTP.Server(8080)

  server.route().get("/:path", fn(req) {
    return handleRequest(req.path)
  })

  server.listen(nil)
}
```

---

## 🏗️ 구조

```
http-module.fl
├── Request         // HTTP 요청
├── Response        // HTTP 응답
├── Parser          // 요청 파싱
├── Router          // 라우팅
└── Server          // 메인 서버
```

---

## 📊 성능

| 항목 | 수치 |
|------|------|
| **메모리 오버헤드** | ~500KB |
| **요청 처리** | 동기 (Single-threaded) |
| **최대 동시 연결** | 1024 (조정 가능) |
| **응답 시간** | <10ms (순수 FreeLang) |

---

## 🔧 마이그레이션: Node.js → FreeLang

### Before (Node.js)
```javascript
const express = require('express');
const app = express();

app.get('/api/users', (req, res) => {
  res.json([{id: 1, name: 'Alice'}]);
});

app.listen(8080);
```

### After (FreeLang v2)
```freelang
use "http-module" as HTTP

fn main(): void {
  let server = HTTP.Server(8080)

  server.route().get("/api/users", fn(req) {
    return HTTP.ok("[{\"id\":1,\"name\":\"Alice\"}]")
  })

  server.listen(nil)
}
```

---

## ✅ 테스트

```bash
# 서버 시작
freelang example-app.fl

# 요청 테스트
curl http://localhost:8080/
curl http://localhost:8080/api/users
curl http://localhost:8080/api/users/1
```

---

## 📝 라이센스

MIT License - 자유롭게 사용, 수정, 배포 가능

---

## 🎯 버전 로드맵

| 버전 | 기능 | 상태 |
|------|------|------|
| **1.0.0** | 기본 HTTP 서버, 라우팅 | ✅ |
| **1.1.0** | 미들웨어, 인증 | 🔄 |
| **1.2.0** | WebSocket 지원 | 📅 |
| **2.0.0** | 비동기, 클러스터링 | 📅 |

---

## 🔗 관련 패키지

- **@freelang/network** - 저수준 네트워크 I/O
- **@freelang/db** - 데이터베이스 연동
- **@freelang/json** - JSON 처리
- **@freelang/vm-core** - VM 핵심 모듈

---

**FreeLang v2 - 순수 구현, 기록 기반, 데이터 중심 언어** 🚀
