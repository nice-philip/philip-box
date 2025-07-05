# Firebase 설정 가이드

## 1. Firebase 프로젝트 생성

1. [Firebase Console](https://console.firebase.google.com/)에 접속
2. "프로젝트 추가" 클릭
3. 프로젝트 이름 입력 (예: dropbox-clone)
4. Google Analytics 설정 (선택사항)
5. 프로젝트 생성 완료

## 2. Firebase Storage 활성화

1. Firebase Console에서 프로젝트 선택
2. 왼쪽 메뉴에서 "Storage" 클릭
3. "시작하기" 클릭
4. 보안 규칙 설정 (테스트 모드 또는 프로덕션 모드)
5. Storage 위치 선택 (예: asia-northeast1)

## 3. 웹 API 키 확인

1. Firebase Console에서 프로젝트 설정 (톱니바퀴 아이콘) 클릭
2. "일반" 탭에서 "웹 API 키" 확인
3. 이 키는 클라이언트에서 Firebase를 사용할 때 필요합니다

## 4. 서비스 계정 키 생성 (중요!)

1. Firebase Console에서 프로젝트 설정 (톱니바퀴 아이콘) 클릭
2. "서비스 계정" 탭 클릭
3. "새 비공개 키 생성" 클릭
4. JSON 파일 다운로드
5. **이 파일을 안전하게 보관하세요!**

## 5. 환경변수 설정

`.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dropbox-clone?retryWrites=true&w=majority

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here

# Server Configuration
PORT=8080
NODE_ENV=development

# Firebase Configuration (서비스 계정 키에서 복사)
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your-project-id.iam.gserviceaccount.com
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com

# Firebase 웹 API 키 (선택사항 - 클라이언트에서 사용)
FIREBASE_API_KEY=your-web-api-key
```

## 6. Firebase 보안 규칙 설정

Firebase Storage 보안 규칙을 다음과 같이 설정하세요:

**방법 1: 테스트 모드 (개발 중 사용)**
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

**방법 2: 프로덕션 모드 (배포 시 사용)**
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // 업로드된 파일에 대한 접근 권한
    match /uploads/{userId}/{allPaths=**} {
      allow read: if true;  // 모든 사용자가 읽을 수 있음
      allow write: if false; // 서버에서만 업로드 가능 (Admin SDK 사용)
    }
  }
}
```

**참고:** Firebase Admin SDK를 사용하면 보안 규칙을 우회할 수 있습니다. 즉, 서버에서는 어떤 규칙이 설정되어 있어도 파일을 업로드할 수 있습니다.

## 7. 환경변수 값 찾기

### 서비스 계정 키 JSON 파일에서:
- `FIREBASE_PROJECT_ID`: `project_id` 값
- `FIREBASE_PRIVATE_KEY_ID`: `private_key_id` 값
- `FIREBASE_PRIVATE_KEY`: `private_key` 값 (이스케이프 처리 필요)
- `FIREBASE_CLIENT_EMAIL`: `client_email` 값
- `FIREBASE_CLIENT_ID`: `client_id` 값
- `FIREBASE_CLIENT_X509_CERT_URL`: `client_x509_cert_url` 값

### Firebase Console에서:
- `FIREBASE_STORAGE_BUCKET`: `{project_id}.appspot.com` 형태
- `FIREBASE_API_KEY`: 프로젝트 설정 > 일반 > 웹 API 키

## 8. 중요한 키 설명

### 🔑 서비스 계정 키 (서버용)
- **용도**: 서버에서 Firebase Admin SDK 사용
- **특징**: 모든 Firebase 서비스에 대한 관리자 권한
- **보안**: 절대 공개하면 안 됨

### 🌐 웹 API 키 (클라이언트용)
- **용도**: 웹/앱 클라이언트에서 Firebase SDK 사용
- **특징**: 제한된 권한, 보안 규칙으로 제어
- **보안**: 공개되어도 상대적으로 안전

## 9. 배포 환경 설정

Render.com 등의 배포 플랫폼에서는 환경변수를 다음과 같이 설정하세요:

1. 배포 플랫폼의 환경변수 설정 페이지로 이동
2. 위의 환경변수들을 하나씩 추가
3. `FIREBASE_PRIVATE_KEY`는 개행 문자(`\n`)가 포함되므로 주의해서 복사

## 10. 테스트

서버를 시작하고 파일 업로드 테스트를 진행하세요:

```bash
npm start
```

## 주의사항

- **서비스 계정 키 파일은 절대 공개 저장소에 업로드하지 마세요**
- 환경변수 파일(`.env`)은 `.gitignore`에 추가하세요
- 프로덕션 환경에서는 적절한 보안 규칙을 설정하세요
- 서비스 계정 키는 Firebase 프로젝트의 "소유자" 권한을 가지므로 매우 중요합니다

## 트러블슈팅

### Firebase 초기화 오류가 발생하는 경우:
1. 환경변수가 올바르게 설정되었는지 확인
2. `FIREBASE_PRIVATE_KEY`의 개행 문자가 올바른지 확인
3. 서비스 계정 키가 올바른 프로젝트의 것인지 확인 