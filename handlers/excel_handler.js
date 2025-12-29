const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

const { readExcelFile } = require("./excel_processor");
const { getCurrentYearMonth } = require("./utill_processor")
const { getConnection } = require("../config/db");
const {writePdfFile} = require("./pdf_processor");

const projectRoot = path.resolve(__dirname, '..'); // 한 단계 위로 올라가서 루트
const fileRootPath = path.join(projectRoot, 'output');

// 영업 유형을 한국어로 변환하는 함수
const salesTypeToKorean = (salesType) => {
    switch (salesType) {
        case 1: return '신규영업자';
        case 2: return '기존영업자';
        default: return '알 수 없음';
    }
};

// 업종을 한국어로 변환하는 함수
const industryTypeToKorean = (industryType) => {
    switch (industryType) {
        case 1: return '일반음식점';
        case 2: return '집단급식소';
        case 3: return '위탁급식업';
        default: return '알 수 없음';
    }
};

// 공통: DB 데이터를 Map 으로 변환
const getDbDataMap = async (dbConfig) => {
    const db = await getConnection(dbConfig);

    const startDate = `2021-01-01`;
    const endDate   = `2025-12-31`;

    const sql = `SELECT * FROM tblUser WHERE regDate >= ? AND regDate < ?`;

    // selectQueryExecuteData 대신 직접 execute 사용
    const [rows] = await db.execute(sql, [startDate, endDate]);

    const dbDataMap = new Map();
    for (const row of rows) {
        dbDataMap.set(row.userPhone, row);
    }
    await db.end(); // 연결 종료

    return dbDataMap;
};

//데이터 베이스 To Pdf
const handleExcelToPDF = async (excelPath, excelOption, pdfPath, dbConfig, failedMappingSavePath) => {
    const { sheetIndex, headerRow, startRow, endRow } = excelOption;
    try {
        const { year, month } = getCurrentYearMonth();
        const excelRowDataList = readExcelFile(excelPath, headerRow, sheetIndex, startRow, endRow);
        const filename = path.parse(excelPath).name;

        const workbook = xlsx.readFile(excelPath);
        const sheetName = workbook.SheetNames[sheetIndex];

        const baseSaveDir = path.join(fileRootPath, year.toString(), month, "PDF");
        const saveDir = path.join(baseSaveDir, filename, sheetName);

        console.log(`[Excel→PDF] 저장 경로: ${saveDir}/**`);

        // DB 데이터 조회
        const dbRowDataMap = await getDbDataMap(dbConfig);
        const finalData = excelToPdfModel(excelRowDataList, dbRowDataMap, failedMappingSavePath);
        console.log(finalData[0]);
        await writePdfFile(finalData, pdfPath, saveDir, 2);
        console.log(`[Excel→PDF] 저장 경로: ${saveDir + "/**"}`);
    } catch (error) {
        console.error('handleExcelToDb ERROR:', error.message);
        throw error;
    }
}

const excelToPdfModel = (excelRowDataList, dbRowDataMap = {}, saveDir) => {
    let matchCount = 0;
    let noMatchCount = 0;
    const failedMatches = [];

    const result = excelRowDataList.map((excelRow, index) => {
        const excelPhone = excelRow['연락처'];

        // 실제 데이터 조회
        const dbRow = dbRowDataMap instanceof Map
            ? dbRowDataMap.get(excelPhone) || {}
            : dbRowDataMap[excelPhone] || {};

        if (dbRow.name) {
            matchCount++;
        } else {
            noMatchCount++;
            // 실패한 데이터 저장
            failedMatches.push({
                연번: excelRow['연번'],
                영업자명: excelRow['영업자명'],
                연락처: excelPhone,
                업소명: excelRow['업소명'],
                업종: excelRow['업종'],
                소재지: excelRow['소재지']
            });
        }

        return {
            // PDF 필수
            회원명: excelRow['영업자명'] ?? dbRow.name,
            인허가번호: excelRow['인허가번호'] ?? dbRow.licenseNumber,
            업종: excelRow['업종'] ?? industryTypeToKorean(dbRow.industryType),
            업소명: excelRow['업소명'] ?? dbRow.businessName,
            소재지: excelRow['소재지'] ?? dbRow.address,
            주소: excelRow['소재지'] ?? dbRow.address,
            연락처: excelRow['연락처'] ?? dbRow.userPhone,
            아이디: dbRow.userId,
            이메일: dbRow.email,
            생년월일: dbRow.birth,
            가입일: dbRow.regDate,
            가입구분: salesTypeToKorean(dbRow.salesType),

            // 파일명 / 날짜용
            연번: dbRow.userNo,
            No: dbRow.userNo,

            // 추가 정보 (필요시)
            년: dbRow.regDate ? new Date(dbRow.regDate).getFullYear() : null,
            월: dbRow.regDate ? new Date(dbRow.regDate).getMonth() + 1 : null,
            일: dbRow.regDate ? new Date(dbRow.regDate).getDate() : null
        };
    });

    console.log(`\n=== 매칭 결과 ===`);
    console.log(`매칭 성공: ${matchCount}건`);
    console.log(`매칭 실패: ${noMatchCount}건`);
    console.log(`매칭률: ${(matchCount / excelRowDataList.length * 100).toFixed(2)}%`);

    if (failedMatches.length > 0) {
        console.log(`\n매칭 실패 목록 (${failedMatches.length}건):`);
        failedMatches.forEach((item, idx) => {
            console.log(`  [${idx + 1}] 연번: ${item.연번} | 이름: ${item.영업자명} | 연락처: ${item.연락처}`);
            console.log(`      업소: ${item.업소명} | 업종: ${item.업종}`);
        });
        if (saveDir) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const failedLogPath = path.join(saveDir, `failed_matches_${timestamp}.json`);
            fs.writeFileSync(failedLogPath, JSON.stringify(failedMatches, null, 2), 'utf-8');
            console.log(`실패 목록 저장: ${failedLogPath}`);
        }
    }
    return result;
};

const handleWriteNotFoundUser = async (excelPath, excelOption, dbConfig) => {
    const { sheetIndex, headerRow, startRow, endRow } = excelOption;
    try {
        const { year, month } = getCurrentYearMonth();
        const readExcelData = readExcelFile(excelPath, headerRow, sheetIndex, startRow, endRow);

        const excelFileName = path.basename(excelPath);

        const baseSaveDir = path.join(fileRootPath, year.toString(), month, "NOT_FOUND_USER");
        const saveDir = path.join(baseSaveDir);

        fs.mkdirSync(saveDir, { recursive: true });

        // DB 데이터 조회
        const { dbMap, normalizePhone } = await getDbDataMap(dbConfig);

        // 매칭 안 된 유저 추적
        const notFoundList = [];

        readExcelData
            .filter(excelRow => excelRow.연락처 != null) //TODO 실제로 Key 값으로 사용 할 Column 명으로 대체 ( null 필터링 )
            .forEach(excelRow => {
                const normalizedPhone = normalizePhone(excelRow.연락처);//TODO 실제로 Key 값으로 사용 할 Column 명으로 대체 ( dbMap 에서 값 가지고오는 부분 )
                const dbRow = dbMap.get(normalizedPhone);

                if (!dbRow) {
                    notFoundList.push({
                        회원명: excelRow.회원명,
                        연락처: excelRow.연락처
                    });
                }
            });

        // 파일로 저장
        if (notFoundList.length > 0) {
            const fileName = `not_found_users_${year}_${month}.txt`;
            const filePath = path.join(saveDir, fileName);

            const fileContent = notFoundList
                .map(user => `${excelFileName}, ${user.회원명}, ${user.연락처}`)
                .join('\n') + '\n';

            fs.appendFileSync(filePath, fileContent, 'utf-8');
            console.log(`매칭 실패 유저: ${notFoundList.length}명 추가`);
        }
    } catch (error) {
        console.error('writeNotFoundUser ERROR:', error.message);
        throw error;
    }
}


module.exports = { handleExcelToPDF, handleWriteNotFoundUser };