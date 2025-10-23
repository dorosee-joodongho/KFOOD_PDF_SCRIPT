const fs = require('fs');
const path = require('path');

/**
 * 디렉토리가 존재하지 않으면 생성
 * @param {string} dirPath - 생성할 디렉토리 경로
 */
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`[ensureDir] 디렉토리 생성: ${dirPath}`);
    } else {
        //console.log(`[ensureDir] 디렉토리 이미 존재: ${dirPath}`);
    }
}

/**
 * 날짜 기반 폴더 생성 후 경로 반환
 * @param {string} typeDir - 'JSON', 'PDF' 등 파일 종류
 * @param {string} baseDir - 기준이 되는 상위 디렉토리
 * @returns {string} 생성된 폴더 경로
 */
function getDatedSaveDir(typeDir, baseDir = __dirname) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    const saveDir = path.join(baseDir, year.toString(), month, typeDir);
    if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir, { recursive: true });
    }
    return saveDir;
}



module.exports = { ensureDir , getDatedSaveDir };
