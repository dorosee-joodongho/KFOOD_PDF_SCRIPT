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
                        console.log(item)
                        const regDate = formatRegDate(item.가입일);
                        item = {
                            ...item,
                            년: regDate ? regDate.year : null,
                            월: regDate ? regDate.month : null,
                            일: regDate ? regDate.day : null
                        };
                    }

                    ensureDir(saveDir);
                    const year = item.년;
                    const month = item.월.padStart(2, "0");

                    const yearDir = path.join(saveDir, year);
                    const monthDir = path.join(yearDir, `${year}.${month}`);

                    fs.mkdirSync(monthDir, { recursive: true });

                    const safeValue = String(`${item.년}.${item.월}.${item.rowNumber || index}.${item.회원명}`);

                    const tempPdfPath = path.join(monthDir, `${safeValue}_temp.pdf`);
                    const finalPdfPath = path.join(monthDir, `${safeValue}.pdf`);

                    let htmlContent = htmlTemplate;

                    const 업종 = item.업종 ?? item['영업자명/업종'] ?? ' ';

                    htmlContent = htmlContent
                        .replace('[[회원명]]', item.회원명 ?? ' ')
                        .replace('[[인허가번호]]', item.인허가번호 ?? ' ')
                        .replace('[[업종]]', 업종)
                        .replace(
                            '[[소재지]]',
                            type === 'excel'
                                ? `${item.소재지 ?? '-'} \n ${item.소재지상세 ?? '-'}`
                                : (item.주소 ?? '-')
                        )
                        .replace('[[연락처]]', formatPhone(item.연락처) ?? ' ')
                        .replace('[[아이디]]', item.아이디 ?? ' ')
                        .replace('[[생년월일]]', formatBirthday(item.생년월일) ?? ' ')
                        .replace('[[이메일]]', item.이메일 ?? ' ')
                        .replace('[[업소명]]', item.업소명 ?? ' ')
                        .replace('[[월]]', item.월 ?? ' ')
                        .replace('[[년]]', item.년 ?? ' ')
                        .replace('[[일]]', item.일 ?? ' ');

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