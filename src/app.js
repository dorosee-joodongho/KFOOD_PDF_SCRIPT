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

for (const arg of args) {
    if (arg.startsWith('--date=')) {
        inputDate = arg.split('=')[1];
    }
}

if (!inputDate) {
    console.error('❌ 날짜 인자가 필요합니다. 예: node src/app.js --date=2025-10-24');
    process.exit(1);
}

const startDate = `${inputDate} 00:00:00`;
const endDate = `${inputDate} 23:59:59`;
const queryTemplate = Query.SELECT_QUERY
const finalQuery = applyDateRange(queryTemplate, startDate, endDate);
console.log(`
    ==================== 실행 쿼리 ====================
    ${finalQuery}
    ==================================================
`);

//TODO 실제로 여기에 Excel 이름 입력하기 배열로
const readingFileList = [];

//포멧 형식에 맞춘 Excel Config
const excelConfig = {
    sheetIndex: 0, //시트 Index
    headerRow: 2,  //몇번째 행부터 시작할지 0부터 시작
    startRow: 1,   //헤더 기준 몇번째 Row 부터 시작할지
    endRow: null   //없을시 종료까지 진행
}

const handlers = {
    //모든 파일과 Sheet 순회
    excel_to_pdf: async () => {
        let rowNumber = 1;

        for (const fileName of readingFileList) {
            const filePath = excelPath + fileName;

            // 1. 파일의 전체 시트 개수 확인
            const workbook = xlsx.readFile(filePath);
            const sheetCount = workbook.SheetNames.length;
            console.log(`\n파일: ${fileName} (총 ${sheetCount}개 시트)`);
            // 2. 각 시트마다 처리
            for (let sheetIndex = 0; sheetIndex < sheetCount; sheetIndex++) {
                console.log(`시트 ${sheetIndex + 1}/${sheetCount} 처리`);
                rowNumber = await handleExcelToPDF(
                    filePath,
                    { ...excelConfig, sheetIndex }, // sheetIndex 동적으로 전달
                    pdfPath,
                    db,
                    rowNumber
                ) + 1;
            }
        }

        console.log(`\n전체 처리 완료! 총 ${rowNumber - 1}개 행 처리`);
    },

    write_not_found_user: async ()=>{
        let rowNumber = 1;

        for (const fileName of readingFileList) {
            const filePath = excelPath + fileName;

            // 1. 파일의 전체 시트 개수 확인
            const workbook = xlsx.readFile(filePath);
            const sheetCount = workbook.SheetNames.length;

            console.log(`\n파일: ${fileName} (총 ${sheetCount}개 시트)`);

            // 2. 각 시트마다 처리
            for (let sheetIndex = 0; sheetIndex < sheetCount; sheetIndex++) {
                console.log(`시트 ${sheetIndex + 1}/${sheetCount} 처리`);

                rowNumber = await handleWriteNotFoundUser(
                    filePath,
                    { ...excelConfig, sheetIndex }, // sheetIndex 동적으로 전달
                    db,
                    rowNumber
                ) + 1;
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

main('db_to_pdf').catch(err => console.error(err));