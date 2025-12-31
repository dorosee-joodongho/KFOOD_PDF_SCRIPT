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
        default: return null;
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
const dbDataCache = new Map();

// 공통: DB 데이터를 Map 으로 변환
const getDbDataMap = async (dbConfig, type) => {
    const db = await getConnection(dbConfig);

    if (dbDataCache.has(type)) {
        console.log(`[캐시 HIT] ${type} 데이터 캐시 사용 (${dbDataCache.get(type).size}건)`);
        return dbDataCache.get(type);
    }

    const startDate = `2023-01-01`;
    const endDate   = `2023-12-31`;

    // const sql = `SELECT * FROM tblUser WHERE regDate >= ? AND regDate < ?`;
    const sql = `SELECT * FROM tblUser WHERE name = '정윤녀'`;

    // selectQueryExecuteData 대신 직접 execute 사용
    const [rows] = await db.execute(sql, [startDate, endDate]);
    if (type === 'origin'){
        const dbDataMap = new Map();
        for (const row of rows) {
            dbDataMap.set(row.originUserPhone, row);
        }
        dbDataCache.set(type, dbDataMap);
        await db.end(); // 연결 종료
        return dbDataMap;
    }else {
        const dbDataMap = new Map();
        for (const row of rows) {
            dbDataMap.set(row.userPhone, row);
        }
        await db.end(); // 연결 종료
        dbDataCache.set(type, dbDataMap);
        return dbDataMap;
    }
};

// //데이터 베이스 To Pdf
// const handleExcelToPDF = async (excelPath, excelOption, pdfPath, dbConfig, failedMappingSavePath) => {
//     const { sheetIndex, headerRow, startRow, endRow } = excelOption;
//     try {
//         const { year, month } = getCurrentYearMonth();
//         const excelRowDataList = readExcelFile(excelPath, headerRow, sheetIndex, startRow, endRow);
//         const filename = path.parse(excelPath).name;
//
//         const workbook = xlsx.readFile(excelPath);
//         const sheetName = workbook.SheetNames[sheetIndex];
//
//         const baseSaveDir = path.join(fileRootPath, year.toString(), month, "PDF");
//         const saveDir = path.join(baseSaveDir, filename, sheetName);
//
//         console.log(`[Excel→PDF] 저장 경로: ${saveDir}/**`);
//
//         // 1차: phone으로 매칭
//         console.log(`\n🔍 1차 매칭 시작 (phone 기준)`);
//         const phoneMap = await getDbDataMap(dbConfig, 'phone');
//         const firstResult = excelToPdfModel(excelRowDataList, phoneMap, failedMappingSavePath, '1차');
//
//         // 2차: 1차에서 실패한 데이터만 originUserPhone으로 재시도
//         if (firstResult.failed.length > 0) {
//             console.log(`\n🔄 2차 매칭 시작 (originUserPhone 기준, ${firstResult.failed.length}건)`);
//             const originMap = await getDbDataMap(dbConfig, 'origin');
//
//             // 1차 실패 데이터만 2차 매칭
//             const secondResult = excelToPdfModel(firstResult.failed, originMap, failedMappingSavePath, '2차');
//
//             console.log(`\n=== 최종 결과 ===`);
//             console.log(`2차 성공: ${secondResult.success.length}건`);
//             console.log(`2차 실패: ${secondResult.failed.length}건`);
//
//             // 2차 성공 데이터만 PDF 생성
//             //await writePdfFile(secondResult.success, pdfPath, saveDir, 2);
//         } else {
//             console.log(`\n✅ 1차에서 모두 매칭 완료!`);
//         }
//
//         console.log(`[Excel→PDF] 저장 경로: ${saveDir}/**`);
//     } catch (error) {
//         console.error('handleExcelToPDF ERROR:', error.message);
//         throw error;
//     }
// }
// const excelToPdfModel = (excelRowDataList, dbRowDataMap = {}, saveDir, phase = '1차') => {
//     let matchCount = 0;
//     let noMatchCount = 0;
//     const failedMatches = [];
//     const successResults = [];
//
//     excelRowDataList.forEach((excelRow, index) => {
//         const excelPhone = excelRow['연락처'];
//
//         // 실제 데이터 조회
//         const dbRow = dbRowDataMap instanceof Map
//             ? dbRowDataMap.get(excelPhone) || {}
//             : dbRowDataMap[excelPhone] || {};
//
//         if (dbRow.name) {
//             matchCount++;
//
//             const licenseNumber = excelRow['인허가번호'] ?? dbRow.licenseNumber;
//             const salesTypeResult = salesTypeToKorean(dbRow.salesType);
//
//             // 성공 데이터
//             successResults.push({
//                 // PDF 필수
//                 회원명: excelRow['영업자명'] ?? dbRow.name,
//                 인허가번호: excelRow['인허가번호'] ?? dbRow.licenseNumber,
//                 업종: excelRow['업종'] ?? industryTypeToKorean(dbRow.industryType),
//                 업소명: excelRow['업소명'] ?? dbRow.businessName,
//                 소재지: excelRow['소재지'] ?? dbRow.address,
//                 주소: excelRow['소재지'] ?? dbRow.address,
//                 연락처: excelRow['연락처'] ?? dbRow.userPhone,
//                 아이디: dbRow.userId,
//                 이메일: dbRow.email,
//                 생년월일: dbRow.birth,
//                 가입일: dbRow.regDate,
//                 가입구분: salesTypeResult ?? (licenseNumber ? '기존영업자' : '신규영업자'),
//
//                 // 파일명 / 날짜용
//                 연번: dbRow.userNo,
//                 No: dbRow.userNo,
//
//                 // 추가 정보 (필요시)
//                 년: dbRow.regDate ? new Date(dbRow.regDate).getFullYear() : null,
//                 월: dbRow.regDate ? new Date(dbRow.regDate).getMonth() + 1 : null,
//                 일: dbRow.regDate ? new Date(dbRow.regDate).getDate() : null
//             });
//         } else {
//             noMatchCount++;
//             // 실패한 데이터 저장
//             failedMatches.push({
//                 연번: excelRow['연번'],
//                 영업자명: excelRow['영업자명'],
//                 연락처: excelPhone,
//                 업소명: excelRow['업소명'],
//                 업종: excelRow['업종'],
//                 소재지: excelRow['소재지']
//             });
//         }
//     });
//
//     console.log(`\n=== ${phase} 매칭 결과 ===`);
//     console.log(`매칭 성공: ${matchCount}건`);
//     console.log(`매칭 실패: ${noMatchCount}건`);
//     console.log(`매칭률: ${(matchCount / excelRowDataList.length * 100).toFixed(2)}%`);
//
//     // if (failedMatches.length > 0 && phase === '2차') {
//     //     console.log(`\n최종 매칭 실패 목록 (${failedMatches.length}건):`);
//     //     failedMatches.forEach((item, idx) => {
//     //         console.log(`  [${idx + 1}] 연번: ${item.연번} | 이름: ${item.영업자명} | 연락처: ${item.연락처}`);
//     //         console.log(`      업소: ${item.업소명} | 업종: ${item.업종}`);
//     //     });
//     //     if (saveDir) {
//     //         const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
//     //         const failedLogPath = path.join(saveDir, `final_failed_matches_${timestamp}.json`);
//     //         fs.writeFileSync(failedLogPath, JSON.stringify(failedMatches, null, 2), 'utf-8');
//     //         console.log(`최종 실패 목록 저장: ${failedLogPath}`);
//     //     }
//     // }
//     if (failedMatches.length > 0 && phase === '2차') {
//         console.log(`\n최종 매칭 실패 목록 (${failedMatches.length}건):`);
//
//         // 전화번호만 추출한 배열
//         const failedPhones = failedMatches.map(item => item.연락처);
//
//         failedMatches.forEach((item, idx) => {
//             console.log(`  [${idx + 1}] 연번: ${item.연번} | 이름: ${item.영업자명} | 연락처: ${item.연락처}`);
//             console.log(`      업소: ${item.업소명} | 업종: ${item.업종}`);
//         });
//
//         if (saveDir) {
//             const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
//             const failedLogPath = path.join(saveDir, `final_failed_phones_${timestamp}.json`);
//             fs.writeFileSync(failedLogPath, JSON.stringify(failedPhones, null, 2), 'utf-8');
//             console.log(`최종 실패 전화번호 목록 저장: ${failedLogPath}`);
//         }
//     }
//
//     return {
//         success: successResults,
//         failed: failedMatches,
//         stats: { matchCount, noMatchCount }
//     };
// };

// // 특정 폴더의 모든 JSON 파일에서 전화번호 추출
const getAllFailedPhones = (logDir) => {
    const allPhones = new Set(); // 중복 제거용

    // log 폴더의 모든 파일 읽기
    const files = fs.readdirSync(logDir);

    // final_failed_phones로 시작하는 JSON 파일만 필터링
    const jsonFiles = files.filter(file =>
        file.startsWith('final_failed_phones_') && file.endsWith('.json')
    );

    console.log(`발견된 파일: ${jsonFiles.length}개`);

    // 각 파일의 전화번호 읽어서 합치기
    jsonFiles.forEach(file => {
        const filePath = path.join(logDir, file);
        const phones = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        phones.forEach(phone => allPhones.add(phone));
    });

    const result = Array.from(allPhones);
    console.log(`전체 전화번호: ${result.length}개 (중복 제거 후)`);

    return result;
};

//데이터 베이스 To Pdf
const handleExcelToPDF = async (excelPath, excelOption, pdfPath, dbConfig, failedMappingSavePath) => {
    const { sheetIndex, headerRow, startRow, endRow } = excelOption;
    try {
        const { year, month } = getCurrentYearMonth();
        let excelRowDataList = readExcelFile(excelPath, headerRow, sheetIndex, startRow, endRow);
        const filename = path.parse(excelPath).name;

        const workbook = xlsx.readFile(excelPath);
        const sheetName = workbook.SheetNames[sheetIndex];

        const baseSaveDir = path.join(fileRootPath, year.toString(), month, "PDF");
        const saveDir = path.join(baseSaveDir, filename, sheetName);

        console.log(`[Excel→PDF] 저장 경로: ${saveDir}/**`);
        const originalCount = excelRowDataList.length;

        // 연락처 null/공란 필터링
        excelRowDataList = excelRowDataList.filter(row => {
            const phone = row['연락처'] || row['휴대폰번호'] || row['전화번호'];
            return phone && phone.toString().trim() !== '';
        });

        console.log(` 실패 번호 필터링: ${originalCount}건 → ${excelRowDataList.length}건`);

        // DB 데이터 조회
        const dbRowDataMap = await getDbDataMap(dbConfig, 'origin');
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

        const licenseNumber = excelRow['인허가번호'] ?? dbRow.licenseNumber;
        const salesTypeResult = salesTypeToKorean(dbRow.salesType);

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
            가입구분: salesTypeResult ?? (licenseNumber ? '기존영업자' : '신규영업자'),

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
// 한글 정규화 함수 (자음/모음 분리 문제 해결)
const normalizeKorean = (str) => {
    if (!str) return '';
    return str.normalize('NFC'); // 정규화
};
const handleWriteNotFoundUser = async (excelPath, excelOption, dbConfig, resultDir) => {
    const { sheetIndex, headerRow, startRow, endRow } = excelOption;
    try {
        if (!resultDir) {
            throw new Error('resultDir이 필요합니다.');
        }

        if (!fs.existsSync(resultDir)) {
            throw new Error(`경로를 찾을 수 없습니다: ${resultDir}`);
        }

        const excelRowDataList = readExcelFile(excelPath, headerRow, 8, startRow, endRow);
        const allItems = fs.readdirSync(resultDir);

        // 파일만 필터링 (폴더 제외)
        const pdfFiles = allItems.filter(item => {
            const fullPath = path.join(resultDir, item);
            return fs.statSync(fullPath).isFile() && item.endsWith('.pdf');
        });

        console.log(`📊 엑셀 데이터: ${excelRowDataList.length}건`);
        console.log(`📄 PDF 파일: ${pdfFiles.length}개\n`);

        // 엑셀에서 이름 추출 (정규화 + 원본)
        const excelList = excelRowDataList
            .map(row => {
                const name = row['영업자명'] || row['회원명'] || row['이름'];
                const no = row['연번'] || row['No'];
                return {
                    name: name,
                    normalized: name ? normalizeKorean(name) : '',
                    no: no,
                    data: row
                };
            })
            .filter(item => item.normalized)
            .sort((a, b) => a.normalized.localeCompare(b.normalized));

        // PDF에서 이름 추출 (정규화 + 원본)
        const pdfList = pdfFiles
            .map(file => {
                const nameMatch = file.match(/_([^.]+)\.pdf$/);
                const name = nameMatch ? nameMatch[1] : file.replace('.pdf', '');
                return {
                    name: name,
                    normalized: normalizeKorean(name),
                    fileName: file
                };
            })
            .sort((a, b) => a.normalized.localeCompare(b.normalized));

        console.log(`\n${'='.repeat(80)}`);
        console.log(`엑셀 정렬 목록 (${excelList.length}개) | PDF 정렬 목록 (${pdfList.length}개)`);
        console.log(`${'='.repeat(80)}`);

        // 나란히 비교하면서 출력
        const maxLength = Math.max(excelList.length, pdfList.length);
        let firstMismatch = null;

        for (let i = 0; i < maxLength; i++) {
            const excel = excelList[i];
            const pdf = pdfList[i];

            const excelStr = excel
                ? `[${String(i + 1).padStart(4, ' ')}] ${excel.normalized.padEnd(20, ' ')} (${excel.name})`
                : ''.padEnd(50, ' ');

            const pdfStr = pdf
                ? `[${String(i + 1).padStart(4, ' ')}] ${pdf.normalized.padEnd(20, ' ')} (${pdf.name})`
                : '';

            // 매칭 여부 확인
            let match = false;
            if (excel && pdf) {
                match = excel.normalized === pdf.normalized ||
                    excel.normalized.includes(pdf.normalized) ||
                    pdf.normalized.includes(excel.normalized);
            } else if (!excel || !pdf) {
                match = false;
            }

            const status = match ? ' ✓' : ' ❌';

            console.log(`${excelStr} | ${pdfStr}${status}`);

            // 첫 번째 불일치 발견 시 멈춤
            if (!match) {
                firstMismatch = {
                    index: i,
                    excel: excel,
                    pdf: pdf
                };
                console.log(`\n⚠️  첫 번째 불일치 발견! 여기서 중단합니다.\n`);
                break;
            }
        }

        // 불일치 항목 상세 출력
        if (firstMismatch) {
            console.log(`${'='.repeat(80)}`);
            console.log(`❌ 불일치 항목 발견 (인덱스: ${firstMismatch.index + 1})`);
            console.log(`${'='.repeat(80)}`);

            if (firstMismatch.excel) {
                const phone = firstMismatch.excel.data['연락처'];
                const businessName = firstMismatch.excel.data['업소명'];
                const address = firstMismatch.excel.data['소재지'] || firstMismatch.excel.data['주소'];
                console.log(`\n📊 엑셀에 있음:`);
                console.log(`  연번: ${firstMismatch.excel.no}`);
                console.log(`  이름: ${firstMismatch.excel.name}`);
                console.log(`  연락처: ${phone || '없음'}`);
                if (businessName) console.log(`  업소명: ${businessName}`);
                if (address) console.log(`  주소: ${address}`);
            } else {
                console.log(`\n📊 엑셀: 없음 (PDF가 더 많음)`);
            }

            if (firstMismatch.pdf) {
                console.log(`\n📄 PDF에 있음:`);
                console.log(`  파일명: ${firstMismatch.pdf.fileName}`);
                console.log(`  이름: ${firstMismatch.pdf.name}`);
            } else {
                console.log(`\n📄 PDF: 없음 (엑셀이 더 많음)`);
            }
        } else {
            console.log(`\n✅ 모든 항목이 일치합니다!`);
        }

        // 엑셀에만 있는 사람 반환
        const notFoundUsers = firstMismatch && firstMismatch.excel && !firstMismatch.pdf
            ? [firstMismatch.excel.data]
            : [];

        return notFoundUsers;

    } catch (error) {
        console.error('writeNotFoundUser ERROR:', error.message);
        throw error;
    }
}

module.exports = { handleExcelToPDF, handleWriteNotFoundUser };