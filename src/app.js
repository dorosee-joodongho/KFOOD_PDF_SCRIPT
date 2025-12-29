const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const { handleDbToPDF } = require("../handlers/db_handler");
const { handleExcelToPDF, handleWriteNotFoundUser } = require("../handlers/excel_handler");
const { logExecution } = require("../handlers/utill_processor");
const Query = require("../config/query");

const uploadedDbConfig = path.join(__dirname, '../properties/app.config-local.json');

let excelPath;
let pdfPath;
let db;

try {
    const rawConfig = fs.readFileSync(uploadedDbConfig, 'utf-8');
    const config = JSON.parse(rawConfig);

    excelPath = config.excel_path;
    pdfPath = config.pdf_output_path;
    db = config.db;

    console.log('Excel Path:', excelPath);
    console.log('PDF Output Path:', pdfPath);
    console.log('DB Config:', db);
} catch (error) {
    console.error('설정 파일 읽기 오류:', error.message);
}
const args = process.argv.slice(2);

let inputDate = null;
let appRunningType = null;

for (const arg of args) {
    if (arg.startsWith('--date=')) {
        inputDate = arg.split('=')[1];
    }
    else if (arg.startsWith('--type=')) {
        appRunningType = arg.split('=')[1];
    }
}

if (appRunningType ==='db_to_pdf' && !inputDate) {
    console.error('날짜 인자가 필요합니다. 예: node src/app.js --date=2025-10-24');
    process.exit(1);
}


const startDate = `${inputDate} 00:00:00`;
const endDate = `${inputDate} 23:59:59`;
const queryTemplate = Query.SELECT_QUERY
const finalQuery = applyDateRange(queryTemplate, startDate, endDate);

if (appRunningType === 'db_to_pdf') {
    console.log(`
    ==================== 실행 쿼리 ====================
    ${finalQuery}
    ==================================================
`);
}

//해당 위치에 있는 파일 목록들 다 가지고오독 설정
const readingFileList = [
    "2021년도 회원가입 명단_20251103_updated_협회확인.xlsx",
    "2022년도 회원가입 명단_20251103_updated_협회확인.xlsx",
    "2023년도 회원가입 명단_20251103_updated_협회확인.xlsx",
    "2024년도 회원가입 명단_20251103_updated_협회확인.xlsx",
    "2025년도 회원가입 명단 ~9월1일_updated_협회확인.xlsx"
];
//포멧 형식에 맞춘 Excel Config
const excelConfig = {
    sheetIndex: 0, //시트 Index
    headerRow: 0,  //몇번째 행부터 시작할지 0부터 시작
    startRow: 1,   //헤더 기준 몇번째 Row 부터 시작할지
    endRow: null
}
const failedMappingSavePath = path.join('/Users/dorosee/Documents/KFOOD_PDF_SCRIPT', 'log');

const handlers = {
    //모든 파일과 Sheet 순회
    excel_to_pdf: async () => {
        const filePath = excelPath + readingFileList[0]; //TODO 추출할 파일만 바꿔주기!
        const workbook = xlsx.readFile(filePath);
        const sheetCount = workbook.SheetNames.length;

        // 2. 각 시트마다 처리
        for (let sheetIndex = 0; sheetIndex < sheetCount; sheetIndex++) {
            console.log(`시트 ${sheetIndex + 1}/${sheetCount} 처리`);
            await handleExcelToPDF(
                filePath,
                { ...excelConfig, sheetIndex }, // sheetIndex 동적으로 전달
                pdfPath,
                db,
                failedMappingSavePath
            );
        }
    },

    write_not_found_user: async ()=>{
        for (const object of readingFileList) {
            const filePath = excelPath + object.filename;

            // 1. 파일의 전체 시트 개수 확인
            const workbook = xlsx.readFile(filePath);
            const sheetCount = workbook.SheetNames.length;

            console.log(`\n파일: ${object} (총 ${sheetCount}개 시트)`);

            // 2. 각 시트마다 처리
            for (let sheetIndex = 0; sheetIndex < sheetCount; sheetIndex++) {
                console.log(`시트 ${sheetIndex + 1}/${sheetCount} 처리`);

                await handleWriteNotFoundUser(
                    filePath,
                    { ...excelConfig, sheetIndex }, // sheetIndex 동적으로 전달
                    db
                );
            }
        }
    },

    db_to_pdf: () => handleDbToPDF(
        db,
        pdfPath,
        finalQuery
    ),
}

function applyDateRange(query, startDate, endDate) {
    return query
        .replace(/__START_DATE__/g, startDate)
        .replace(/__END_DATE__/g, endDate);
}

const handlersWithLogging = Object.fromEntries(
    Object.entries(handlers).map(([key, fn]) => [key, logExecution(key, fn)])
);

async function main(appRunningType, options = {}) {
    const handler = handlersWithLogging[appRunningType];
    if (!handler) throw new Error(`알 수 없는 appRunningType: ${appRunningType}`);
    await handler(options);
}

main(`${appRunningType}`).catch(err => console.error(err));