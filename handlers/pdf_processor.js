const fs = require("fs");
const path = require("path");
const puppeteer =require("puppeteer");
const {ensureDir} = require("./file_processor");
const { exec } = require("child_process");

// 전화번호 포맷 함수
function formatPhone(number) {
    if (!number) return '-';
    // 숫자만 추출
    const digits = number.replace(/\D/g, '');
    if (digits.length === 11) {
        return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    } else if (digits.length === 10) {
        return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    }
    return number; // 포맷 불가 시 그대로
}

// 생년월일 포맷 함수 (YYYYMMDD -> YYYY-MM-DD)
function formatBirthday(birth) {
    if (!birth) return '-';
    const digits = birth.replace(/\D/g, '');
    if (digits.length === 8) {
        return digits.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
    }
    return birth;
}

function compressPdf(inputPath, outputPath, quality = "/ebook") {
    return new Promise((resolve, reject) => {
        const cmd = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=${quality} -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${outputPath}" "${inputPath}"`;

        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                reject(`Ghostscript 압축 실패: ${stderr}`);
            } else {
                resolve(outputPath);
            }
        });
    });
}

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

async function writePdfFile(data, pdfPath, saveDir, concurrency = 8, type) {
    try {
        const htmlTemplate = fs.readFileSync(pdfPath, 'utf-8');
        const pdfPaths = [];
        const startTime = Date.now();
        let index = 0;

        async function worker() {
            while (true) {
                const i = index++;
                if (i >= data.length) break;
                let item = data[i];

                try {
                    if (item.년 == null) {
                        const regDate = formatRegDate(item.가입일);
                        item = {
                            ...item,
                            년: regDate ? regDate.year : null,
                            월: regDate ? regDate.month : null,
                            일: regDate ? regDate.day : null
                        };
                    }

                    ensureDir(saveDir);
                    const dayDir = path.join(saveDir)
                    ensureDir(dayDir); // 일별 디렉토리 생성
                    const safeValue = String(`${item.년}.${item.월}.${item.일}.${item.No}_${item.회원명}`);

                    fs.mkdirSync(dayDir, { recursive: true });

                    const tempPdfPath = path.join(dayDir, `${safeValue}_temp.pdf`);
                    const finalPdfPath = path.join(dayDir, `${safeValue}.pdf`);

                    let htmlContent = htmlTemplate;

                    const 업종 = item.업종 ?? item['영업자명/업종'] ?? ' ';

                    htmlContent = htmlContent
                        .replace('[[회원명]]', () => {
                            if (!item.회원명) console.log('회원명 값 없음', item.아이디);
                            return item.회원명 ?? ' ';
                        })
                        .replace('[[인허가번호]]', () => {
                            if (!item.인허가번호) console.log('인허가번호 값 없음', item.아이디);
                            return item.인허가번호 ?? ' ';
                        })
                        .replace('[[업종]]', () => {
                            if (!업종) console.log('업종 값 없음', item);
                            return 업종 ?? ' ';
                        })
                        .replace('[[소재지]]', () => {
                            const value = type === 'excel'
                                ? `${item.소재지 ?? '-'} \n ${item.소재지상세 ?? '-'}`
                                : (item.주소 ?? '-');
                            if (!item.소재지 && !item.주소) console.log('소재지 값 없음', item.아이디);
                            return value;
                        })
                        .replace('[[연락처]]', () => {
                            const value = formatPhone(item.연락처) ?? ' ';
                            if (!item.연락처) console.log('연락처 값 없음', item.아이디);
                            return value;
                        })
                        .replace('[[아이디]]', () => {
                            if (!item.아이디) console.log('아이디 값 없음', item.아이디);
                            return item.아이디 ?? ' ';
                        })
                        .replace('[[생년월일]]', () => {
                            const value = formatBirthday(item.생년월일) ?? ' ';
                            if (!item.생년월일) console.log('생년월일 값 없음', item.아이디);
                            return value;
                        })
                        .replace('[[이메일]]', () => {
                            if (!item.이메일) console.log('이메일 값 없음', item.아이디);
                            return item.이메일 ?? ' ';
                        })
                        .replace('[[업소명]]', () => {
                            if (!item.업소명) console.log('업소명 값 없음', item.아이디);
                            return item.업소명 ?? ' ';
                        })
                        .replace('[[월]]', () => {
                            if (!item.월) console.log('월 값 없음', item.아이디);
                            return item.월 ?? ' ';
                        })
                        .replace('[[년]]', () => {
                            if (!item.년) console.log('년 값 없음', item.아이디);
                            return item.년 ?? ' ';
                        })
                        .replace('[[일]]', () => {
                            if (!item.일) console.log('일 값 없음', item.아이디);
                            return item.일 ?? ' ';
                        });


                    const browser = await puppeteer.launch();
                    const page = await browser.newPage();
                    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

                    await page.pdf({
                        path: tempPdfPath,
                        format: 'A4',
                        printBackground: true,
                        scale: 0.8
                    });

                    await browser.close();

                    await compressPdf(tempPdfPath, finalPdfPath, "/ebook");

                    fs.unlinkSync(tempPdfPath);

                    pdfPaths.push(finalPdfPath);

                    if ((i + 1) % 10 === 0 || i === data.length - 1) {
                        const elapsed = (Date.now() - startTime) / 1000;
                        const avgTime = elapsed / (i + 1);
                        const remaining = avgTime * (data.length - (i + 1));
                        console.log(`
                        PDF 생성 진행: ${i + 1}/${data.length} |
                        경과: ${elapsed.toFixed(1)}s |
                        예상 남은 시간: ${remaining.toFixed(1)}s`);
                    }

                } catch (error) {
                    console.error(`❌ PDF 생성 실패 [인덱스: ${i}]`);
                    console.error(data[i]);
                    console.error("에러:", error.message);
                    console.error("=".repeat(50) + "\n");
                    continue;
                }
            }
        }

        const workers = [];
        for (let w = 0; w < concurrency; w++) {
            workers.push(worker());
        }
        await Promise.all(workers);

        return pdfPaths;
    } catch (e) {
        console.log(e)
        throw e
    }
}

module.exports = {writePdfFile}