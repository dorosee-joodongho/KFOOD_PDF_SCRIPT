const fs = require('fs');
const xlsx = require('xlsx');

const readExcelFile = (filePath, headerRow = 0, sheetIndex = 0, startRow = 1, endRow = null, rowNumber) => {
    if (!fs.existsSync(filePath))
        throw new Error(`파일이 존재하지 않습니다: ${filePath}`);

    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[sheetIndex];
    const worksheet = workbook.Sheets[sheetName];

    let data = xlsx.utils.sheet_to_json(worksheet, {
        range: headerRow,
        raw: false,
        dateNF: 'yyyy-mm-dd',
        defval: null // 빈 셀은 null로 처리
    });

    // 해당 Index Row 까지 읽기
    if (startRow > 1 || endRow) {
        const startIndex = startRow - 1;
        const endIndex = endRow ? endRow : data.length;
        data = data.slice(startIndex, endIndex);
    }

    // rowNumber 붙이기 (1부터 시작)
    data = data.map((row, idx) => ({
        rowNumber: rowNumber + idx,
        ...row
    }));

    console.log(`[ READ_EXCEL_FILE ] Excel 읽기 완료 경로: ${filePath}, 총 rows: ${data.length}`);

    return data;
};

module.exports = { readExcelFile };