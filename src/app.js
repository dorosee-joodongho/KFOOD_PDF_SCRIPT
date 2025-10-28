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

if (appRunningType === 'db_to_pdf' && !inputDate) {
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
    // { filename: '2025년 9월 1일 회원가입 명부.xlsx', startDate: '2025-09-01', endDate: '2025-09-01' },
    // { filename: '2025년 9월 2일 회원가입 명부.xlsx', startDate: '2025-09-02', endDate: '2025-09-02' },
    // { filename: '2025년 9월 3일 회원가입 명부.xlsx', startDate: '2025-09-03', endDate: '2025-09-03' },
    // { filename: '2025년 9월 4일 회원가입 명부.xlsx', startDate: '2025-09-04', endDate: '2025-09-04' },
    // { filename: '2025년 9월 5~7일 회원가입 명부.xlsx', startDate: '2025-09-05', endDate: '2025-09-07' },
    // { filename: '2025년 9월 8일 회원가입 명부.xlsx', startDate: '2025-09-08', endDate: '2025-09-08' },
    // { filename: '2025년 9월 9일 회원가입 명부.xlsx', startDate: '2025-09-09', endDate: '2025-09-09' },
    // { filename: '2025년 9월 10일 회원가입 명부.xlsx', startDate: '2025-09-10', endDate: '2025-09-10' },
    // { filename: '2025년 9월 11일 회원가입 명부.xlsx', startDate: '2025-09-11', endDate: '2025-09-11' },
    // { filename: '2025년 9월 12~14일 회원가입 명부.xlsx', startDate: '2025-09-12', endDate: '2025-09-14' },
    // { filename: '2025년 9월 15일 회원가입 명부.xlsx', startDate: '2025-09-15', endDate: '2025-09-15' },
    // { filename: '2025년 9월 16일 회원가입 명부.xlsx', startDate: '2025-09-16', endDate: '2025-09-16' },
    // { filename: '2025년 9월 17일 회원가입 명부.xlsx', startDate: '2025-09-17', endDate: '2025-09-17' },
    // { filename: '2025년 9월 18일 회원가입 명부.xlsx', startDate: '2025-09-18', endDate: '2025-09-18' },
    // { filename: '2025년 9월 19일~21일 회원가입 명부.xlsx', startDate: '2025-09-19', endDate: '2025-09-21' },
    // { filename: '2025년 9월 22일 회원가입 명부.xlsx', startDate: '2025-09-22', endDate: '2025-09-22' },
    // { filename: '2025년 9월 23일 회원가입 명부.xlsx', startDate: '2025-09-23', endDate: '2025-09-23' },
    // { filename: '2025년 9월 24일 회원가입 명부.xlsx', startDate: '2025-09-24', endDate: '2025-09-24' },
    // { filename: '2025년 9월 25일 회원가입 명부.xlsx', startDate: '2025-09-25', endDate: '2025-09-25' },
    // { filename: '2025년 9월 26일~28일 회원가입 명부.xlsx', startDate: '2025-09-26', endDate: '2025-09-28' },
    // { filename: '2025년 9월 29일 회원가입 명부.xlsx', startDate: '2025-09-29', endDate: '2025-09-29' },
    // { filename: '2025년 9월 30일 회원가입 명부.xlsx', startDate: '2025-09-30', endDate: '2025-09-30' },
    // { filename: '2025년 10월 1일 회원가입 명부.xlsx', startDate: '2025-10-01', endDate: '2025-10-01' },
    // { filename: '2025년 10월 2-9일 회원가입 명부.xlsx', startDate: '2025-10-02', endDate: '2025-10-09' },
    // { filename: '2025년 10월 10일~12일 회원가입 명부.xlsx', startDate: '2025-10-10', endDate: '2025-10-12' },
    // { filename: '2025년 10월 13일 회원가입 명부.xlsx', startDate: '2025-10-13', endDate: '2025-10-13' },
    // { filename: '2025년 10월 14일 회원가입 명부.xlsx', startDate: '2025-10-14', endDate: '2025-10-14' },
    // { filename: '2025년 10월 15일 회원가입 명부.xlsx', startDate: '2025-10-15', endDate: '2025-10-15' },
    // { filename: '2025년 10월 16일 회원가입 명부.xlsx', startDate: '2025-10-16', endDate: '2025-10-16' },
    // { filename: '2025년 10월 17일~19일 회원가입 명부.xlsx', startDate: '2025-10-17', endDate: '2025-10-19' },
    // { filename: '2025년 10월 20일 회원가입 명부.xlsx', startDate: '2025-10-20', endDate: '2025-10-20' },
    // { filename: '2025년 10월 21일 회원가입 명부.xlsx', startDate: '2025-10-21', endDate: '2025-10-21' },
    { filename: '2025년 10월 22일 회원가입 명부.xlsx', startDate: '2025-10-22', endDate: '2025-10-22' },
    { filename: '2025년 10월 23일 회원가입 명부.xlsx', startDate: '2025-10-23', endDate: '2025-10-23' },
    { filename: '2025년 10월 24일~26일 회원가입 명부.xlsx', startDate: '2025-10-24', endDate: '2025-10-26' },
    { filename: '2025년 10월27일 회원명부.xlsx', startDate: '2025-10-27', endDate: '2025-10-27' }
];
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
        for (const object of readingFileList) {
            const filePath = excelPath + object.filename;
            // 1. 파일의 전체 시트 개수 확인
            const workbook = xlsx.readFile(filePath);
            const sheetCount = workbook.SheetNames.length;
            console.log(`\n파일: ${object.filename} (총 ${sheetCount}개 시트)`);
            // 2. 각 시트마다 처리
            for (let sheetIndex = 0; sheetIndex < sheetCount; sheetIndex++) {
                console.log(`시트 ${sheetIndex + 1}/${sheetCount} 처리`);
                await handleExcelToPDF(
                    filePath,
                    { ...excelConfig, sheetIndex }, // sheetIndex 동적으로 전달
                    pdfPath,
                    db
                );
            }
        }

        console.log(`\n전체 처리 완료! 총 ${rowNumber - 1}개 행 처리`);
    },

    write_not_found_user: async () => {
        for (const fileName of readingFileList) {
            const filePath = excelPath + fileName.filename;

            // 1. 파일의 전체 시트 개수 확인
            const workbook = xlsx.readFile(filePath);
            const sheetCount = workbook.SheetNames.length;

            console.log(`\n파일: ${fileName} (총 ${sheetCount}개 시트)`);

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