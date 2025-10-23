
const isTableExist = async (tableName, db) => {
    try {
        const result = await db.query(`SELECT 1 FROM ${tableName} LIMIT 1;`);
        return true;
    } catch (err) {
        return false;
    }
};

const selectQueryExecuteData = async (selectTableName, conn, query = null) => {
    try {
        const tableExists = await isTableExist(selectTableName, conn);

        if (!tableExists)
            throw new Error(`해당 테이블이 존재하지 않습니다. ${selectTableName}`);

        const [rows] = await conn.execute(`${query}`);
        console.log(`[ SELECT_DATA ] 조회 완료 Table: ${selectTableName}, Rows: ${rows.length}`);

        return rows;
    } catch (error) {
        console.error(`[ SELECT_DATA ERROR ] ${error.message}`);
        throw error;
    }
};

module.exports = {selectQueryExecuteData}