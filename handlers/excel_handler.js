const path = require('path');
const fs = require('fs');

const {writePdfFile} = require("./pdf_processor")
const {readExcelFile} = require("./excel_processor");
const {getCurrentYearMonth} = require("./utill_processor")
const {selectQueryExecuteData} = require("./db_processor");
const {getConnection} = require("../config/db");

const projectRoot = path.resolve(__dirname, '..'); // 한 단계 위로 올라가서 루트
const fileRootPath = path.join(projectRoot, 'output');

// 공통: DB 데이터를 Map으로 변환
const getDbDataMap = async (dbConfig) => {
    const db = await getConnection(dbConfig);
    const readDbData = await selectQueryExecuteData("tblUser", db, `
        SELECT *
        FROM tblUser
        WHERE regdate BETWEEN '2025-08-01 00:00:00' AND '2025-10-22 00:00:00';
    `);

    const dbMap = new Map();
    const duplicateMap = new Map();
    const normalizePhone = (phone) => String(phone).trim().replace(/\D/g, '');

    readDbData.forEach(item => {
        const normalizedKey = normalizePhone(item.userPhone);

        if (dbMap.has(normalizedKey)) {
            if (!duplicateMap.has(normalizedKey)) {
                duplicateMap.set(normalizedKey, [dbMap.get(normalizedKey)]);
            }
            duplicateMap.get(normalizedKey).push(item);
        }

        dbMap.set(normalizedKey, item);
    });

    return { dbMap, duplicateMap, normalizePhone };
};

//데이터 베이스 To Pdf
const handleExcelToPDF = async (excelPath, excelOption, pdfPath, dbConfig, rowNumber) => {
    const {sheetIndex, headerRow, startRow, endRow} = excelOption;

    try {
        const {year, month} = getCurrentYearMonth();
        const readExcelData = readExcelFile(excelPath, headerRow, sheetIndex, startRow, endRow, rowNumber);

        const randomStr = "k_food"
        const baseSaveDir = path.join(fileRootPath, year.toString(), month, "PDF");
        const saveDir = path.join(baseSaveDir, randomStr);

        // DB 데이터 조회
        const { dbMap, duplicateMap, normalizePhone } = await getDbDataMap(dbConfig);
        printDuplicatePhones(duplicateMap);

        // 엑셀 데이터에 DB 데이터 병합
        const mergedData = readExcelData
            .filter(excelRow => excelRow.연락처 != null)
            .map(excelRow => {
                const dbRow = dbMap.get(normalizePhone(excelRow.연락처));
                const regDate = dbRow && dbRow.regDate ? formatRegDate(dbRow.regDate) : null;

                return {
                    ...excelRow,
                    아이디: dbRow? dbRow.userId : null,
                    소재지: excelRow.소재지 ?? (dbRow ? dbRow.address : null),
                    소재지상세: excelRow.소재지상세 ?? (dbRow ? dbRow.address2 : null),
                    생년월일: dbRow ? dbRow.birth : null,
                    이메일: dbRow ? dbRow.email : null,
                    가입일: dbRow? dbRow.regDate : null,
                    년: regDate ? regDate.year : null,
                    월: regDate ? regDate.month : null,
                    일: regDate ? regDate.day : null
                };
            });

        const lastRowNumber = mergedData?.[mergedData.length - 1]?.rowNumber ?? null;
        await writePdfFile(mergedData, pdfPath, saveDir, 2, "excel");

        console.log(`[Excel→PDF] 저장 경로: ${saveDir + "/**"}`);
        return lastRowNumber
    } catch (error) {
        console.error('handleExcelToDb ERROR:', error.message);
        throw error;
    }
}

const handleWriteNotFoundUser = async (excelPath, excelOption, dbConfig, rowNumber) => {
    const {sheetIndex, headerRow, startRow, endRow} = excelOption;
    try {
        const {year, month} = getCurrentYearMonth();
        const readExcelData = readExcelFile(excelPath, headerRow, sheetIndex, startRow, endRow, rowNumber);

        const excelFileName = path.basename(excelPath);

        const randomStr = "k_food"
        const baseSaveDir = path.join(fileRootPath, year.toString(), month, "NOT_FOUND_USER");
        const saveDir = path.join(baseSaveDir, randomStr);

        fs.mkdirSync(saveDir, { recursive: true });

        // DB 데이터 조회
        const { dbMap, normalizePhone } = await getDbDataMap(dbConfig);

        // 매칭 안 된 유저 추적
        const notFoundList = [];

        readExcelData
            .filter(excelRow => excelRow.연락처 != null)
            .forEach(excelRow => {
                const normalizedPhone = normalizePhone(excelRow.연락처);
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

        const lastRowNumber = readExcelData?.[readExcelData.length - 1]?.rowNumber ?? null;
        return lastRowNumber;
    } catch (error) {
        console.error('writeNotFoundUser ERROR:', error.message);
        throw error;
    }
}

const printDuplicatePhones = (duplicateMap) => {
    if (duplicateMap.size > 0) {
        console.log("\n=== 중복된 연락처 발견 ===");
        console.log(`총 중복 번호 수: ${duplicateMap.size}개\n`);

        duplicateMap.forEach((users, phone) => {
            console.log(`📞 연락처: ${phone} (${users.length}건 중복)`);
            console.log("─".repeat(50));
            users.forEach((user, idx) => {
                console.log(`  [${idx + 1}] 이름: ${user.userName || 'N/A'}`);
                console.log(`      ID: ${user.userId || 'N/A'}`);
                console.log(`      이메일: ${user.email || 'N/A'}`);
                console.log(`      가입일: ${user.regDate || 'N/A'}`);
                console.log(`      주소: ${user.address || 'N/A'}`);
                console.log();
            });
            console.log("=".repeat(50) + "\n");
        });
    } else {
        console.log("중복된 연락처 없음\n");
    }
};

function formatRegDate(regDate) {
    if (!regDate) return null;

    const dateObj = new Date(regDate);
    if (isNaN(dateObj)) return null;

    return {
        year: dateObj.getFullYear().toString(),
        month: String(dateObj.getMonth() + 1).padStart(2, '0'),
        day: String(dateObj.getDate()).padStart(2, '0')
    };
}

module.exports = {handleExcelToPDF , handleWriteNotFoundUser};