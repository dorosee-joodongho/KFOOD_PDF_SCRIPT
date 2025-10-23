const mysql = require('mysql2/promise');


const testDbConnection = async ({ host, port, user, password, database }) => {
    try {
        const conn = await mysql.createConnection({ host, port, user, password, database });
        const [rows] = await conn.execute('SELECT 1'); // 간단 테스트 쿼리
        await conn.end();

        console.log('✅ DB 연결 성공:', host, database);
        return {
            success: true,
            message: 'DB 연결 성공',
            data: rows
        };
    } catch (error) {
        console.error(host , port , user , password, database)
        console.error('❌ DB 연결 실패:', error.message);
        return {
            success: false,
            message: `DB 연결 실패: ${error.message}`,
            data: null
        };
    }
};

const getConnection = async (dbConfig) => {
    try {
        const { host, port, user, password, database } = dbConfig
        const conn = await mysql.createConnection(dbConfig);
        console.log('DB 커넥션 생성 성공:', host, database);
        return conn;
    } catch (error) {

        console.error('DB 커넥션 생성 실패:', error.message);
        throw new Error(`DB 연결 실패: ${error.message}`);
    }
};

module.exports = {testDbConnection, getConnection}