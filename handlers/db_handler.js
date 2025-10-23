const fs = require("fs");
const path = require("path");
const {getConnection} = require("../config/db");
const {writePdfFile} = require("./pdf_processor")
const {selectQueryExecuteData} = require("./db_processor")

const projectRoot = path.resolve(__dirname, '..');
const fileRootPath = path.join(projectRoot, 'output');

function getCurrentYearMonth() {
    const now = new Date();
    return {
        year: now.getFullYear(),
        month: String(now.getMonth() + 1).padStart(2, '0') // '01' ~ '12'
    };
}

const handleDbToPDF = async (dbConfig, pdfPath, query) => {
    try {
        const db = await getConnection(dbConfig)
        const data = await selectQueryExecuteData("tblUser", db, query);

        // 2.날짜/시간 가져오기
        const {year, month} = getCurrentYearMonth();

        const base = "k_food"
        const baseSaveDir = path.join(fileRootPath, year.toString(), month, "PDF");
        const saveDir = path.join(baseSaveDir, base);

        console.log("fileRootPath:", fileRootPath);
        console.log("saveDir:", saveDir);
        console.log("유저 데이터 조회 완료 " + data.length)
        console.log("유저 데이터 조회 완료\n", JSON.stringify(data[0], null, 2));

        const pdfSaveFilePath = await writePdfFile(data, pdfPath, saveDir, 2);

        console.log("PDF 생성 완료");
    } catch (e) {
        console.log(e)
        console.log("PDF 생성 중 오류 발생 완료");
    }
};




module.exports = {handleDbToPDF};

