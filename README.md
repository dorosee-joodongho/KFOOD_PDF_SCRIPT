## 📄 PDF 추출 사용방법

### 1. DB -> PDF
데이터베이스 쿼리 결과를 PDF로 생성.

#### 실행방법
```
// 해당 리파지토리 Root 폴더 위치에서 아래 스크립트 실행
./run.sh
```

- 날짜만 입력하면 처리됩니다.
- 쿼리에 나온 결과를 기반으:로 PDF를 생성.

### 2. Excel -> PDF
지정한 Excel 파일의 내용을 PDF로 변환

**설정 및 사용 방법:**

1. `app.js`의 `readingFileList = []`에 처리할 Excel 파일 이름을 추가.
2. `./storage/excel/` 하위에 처리할 Excel 파일 추가 
3. `/handlers/excel_handler.js`의 `getDbDataMap` 함수는 DB에서 가져온 데이터를 Map으로 변환합니다.  
   *(TODO 목록을 참고하여 키 값 수정 필요)*
4. `/handlers/excel_handler.js`의 `handleExcelToPDF` 함수는 Excel 데이터와 DB Map을 활용하여 PDF를 생성합니다.
5. PDF 저장 경로 예시:  /output/{생성년도}/{생성월}/PDF/k_food/2025{regDate의 년도}/2025.09{regDate의 년도.월일}

### 3. 찾을 수 없는 사용자 기록
Excel 파일에서 DB에 없는 사용자를 별도로 기록.

**설정 및 사용 방법:**

1. `app.js`의 `readingFileList = []`에 처리할 Excel 파일 이름을 추가합니다.
2. `./storage/excel/` 하위에 처리할 Excel 파일 추가 
3. `/handlers/excel_handler.js`의 `getDbDataMap` 함수는 DB에서 가져온 데이터를 Map으로 변환합니다.  
   *(TODO 목록을 참고하여 키 값 수정 필요)*
4. `/handlers/excel_handler.js`의 `handleWriteNotFoundUser` 함수는 Excel 데이터와 DB Map을 활용하여 매핑되지 않은 사용자를 추출합니다.
5. TXT 저장 경로 예시: /output/{생성년도}/{생성월}/NOT_FOUND_USER/k_food/{파일명}.txt

### 4. Ghostscript 설치 (macOS 기준)
1. brew install ghostscript
2. gs --version
3. 설치 후 버전 확인 버전이 정상적으로 나오면 설치완료
