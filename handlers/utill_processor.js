

const logExecution = (title, fn) => async (...args) => {
    const start = new Date();
    console.log(`[START] ${title} - ${start.toISOString()}`);
    try {
        const result = await fn(...args);
        return result;
    } catch (e) {
        console.error(`[ERROR] ${title} -`, e);
        throw e;
    } finally {
        const end = new Date();
        console.log(`[END] ${title} - ${end.toISOString()} | Duration: ${end - start}ms`);
    }
};

function getCurrentYearMonth() {
    const now = new Date();
    return {
        year: now.getFullYear(),
        month: String(now.getMonth() + 1).padStart(2, '0') // '01' ~ '12'
    };
}

function getCurrentTime() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const ms = String(new Date().getMilliseconds()).padStart(3, '0'); // 충돌 방지용 밀리초
    return {
        hh: hh,
        mm: mm,
        ss: ss,
        ms :ms
    }
}

//9월1월 ~ 10/21일까지
function parsingTemplateJson(){


}
module.exports = {logExecution , getCurrentYearMonth, getCurrentTime}